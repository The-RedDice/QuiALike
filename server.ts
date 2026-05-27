import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { nanoid } from "nanoid";
import { Room, Player, Video } from "./src/types";
import dotenv from "dotenv";
import axios from "axios";
import cookieParser from "cookie-parser";

dotenv.config();

const dev = process.env.NODE_ENV !== "production";
const publicHostname = process.env.SERVER_IP || "localhost";
// Always use 0.0.0.0 internally to bypass NAT restrictions on VPS (like Oracle Cloud)
// Next.js will use this internally, and we also pass it to our custom server.listen.
const bindHostname = "0.0.0.0";

// Forcefully delete HOSTNAME and HOST from environment before Next.js initializes.
// If Next.js detects these, it will try to bind to them instead of 0.0.0.0, causing EADDRNOTAVAIL on Oracle VPS.
if (process.env.HOSTNAME) delete process.env.HOSTNAME;
if (process.env.HOST) delete process.env.HOST;

const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname: bindHostname, port });
const handle = app.getRequestHandler();

const MOCK_VIDEOS: Video[] = [
  { id: "1", url: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnail: "", correctPlayerIds: [] },
  { id: "2", url: "https://www.w3schools.com/html/horse.mp4", thumbnail: "", correctPlayerIds: [] },
  { id: "3", url: "https://www.w3schools.com/html/movie.mp4", thumbnail: "", correctPlayerIds: [] },
];

const rooms: Map<string, Room> = new Map();

app.prepare().then(() => {
  const expressApp = express();
  expressApp.use(cookieParser());
  const server = createServer(expressApp);
  const io = new Server(server);

  // TikTok OAuth Routes
  expressApp.get("/api/auth/tiktok", (req, res) => {
    const csrfState = Math.random().toString(36).substring(2);
    // Set CSRF max age to 10 minutes (600,000 ms) so users have time to log in
    res.cookie("csrfState", csrfState, { maxAge: 600000 });

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return res.status(500).send("TikTok Client Key not configured");
    }

    let url = "https://www.tiktok.com/v2/auth/authorize/";
    url += `?client_key=${clientKey}`;
    url += "&scope=user.info.basic";
    url += "&response_type=code";
    url += `&redirect_uri=${encodeURIComponent(process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/auth/tiktok/callback')}`;
    url += `&state=${csrfState}`;

    res.redirect(url);
  });

  expressApp.get("/api/auth/tiktok/callback", async (req, res) => {
    const { code, state } = req.query;
    const csrfState = req.cookies.csrfState;

    if (state !== csrfState) {
      return res.status(400).send("Invalid state parameter");
    }

    try {
      const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
      const redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/auth/tiktok/callback';

      const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
        client_key: clientKey || '',
        client_secret: clientSecret || '',
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        }
      });

      const accessToken = tokenResponse.data.access_token;

      const userInfoUrl = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name";
      const userInfoResponse = await axios.get(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const user = userInfoResponse.data.data.user;

      // Redirect back to the frontend with the user data in a cookie or query params
      // Using cookies for a cleaner URL
      const profile = {
        username: user.display_name,
        avatar: user.avatar_url
      };

      res.cookie("tiktok_profile", JSON.stringify(profile), { maxAge: 3600000 }); // 1 hour
      res.redirect("/");

    } catch (error) {
      console.error("TikTok OAuth error:", error);
      res.redirect("/?error=auth_failed");
    }
  });

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);
    socket.on("create-room", (userData: { username: string, avatar: string }) => {
      console.log("Create room requested by:", userData.username);
      const roomCode = nanoid(6).toUpperCase();
      const host: Player = {
        id: socket.id,
        username: userData.username,
        avatar: userData.avatar,
        score: 0,
        isHost: true,
        likedVideos: []
      };

      const room: Room = {
        code: roomCode,
        players: [host],
        status: 'lobby',
        currentVideoIndex: 0,
        videos: [],
        settings: {
          videosPerPlayer: 2
        }
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.emit("room-created", room);
      console.log("Room created:", roomCode);
    });

    socket.on("join-room", (roomCode: string, userData: { username: string, avatar: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room) {
        socket.emit("error", "Salle non trouvée");
        return;
      }

      if (room.status !== 'lobby') {
        socket.emit("error", "La partie a déjà commencé");
        return;
      }

      const player: Player = {
        id: socket.id,
        username: userData.username,
        avatar: userData.avatar,
        score: 0,
        isHost: false,
        likedVideos: []
      };

      room.players.push(player);
      socket.join(cleanCode);
      io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("start-game", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.players[0].id !== socket.id) return;

      room.status = 'playing';
      room.currentVideoIndex = 0;

      const totalVideosNeeded = Math.max(5, room.players.length * room.settings.videosPerPlayer);
      room.videos = [];
      for (let i = 0; i < totalVideosNeeded; i++) {
        const mockVideo = MOCK_VIDEOS[i % MOCK_VIDEOS.length];
        const video = { ...mockVideo, id: `${mockVideo.id}-${i}-${cleanCode}`, correctPlayerIds: [] as string[] };

        const numLikers = Math.floor(Math.random() * Math.min(room.players.length, 2)) + 1;
        const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
        const likers = shuffledPlayers.slice(0, numLikers);

        video.correctPlayerIds = likers.map(p => p.id);
        room.videos.push(video);
      }

      room.videos.sort(() => 0.5 - Math.random());
      io.to(cleanCode).emit("game-started", room);
    });

    socket.on("submit-vote", ({ roomCode, targetPlayerId, timeTaken }: { roomCode: string, targetPlayerId: string, timeTaken: number }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.status !== 'playing') return;

      const currentVideo = room.videos[room.currentVideoIndex];
      const isCorrect = currentVideo.correctPlayerIds.includes(targetPlayerId);

      if (isCorrect) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          // Score based on speed (max 1000 points, min 100)
          const points = Math.max(100, Math.floor(1000 * (1 - timeTaken / 30000)));
          player.score += points;
        }
      }

      socket.emit("vote-result", { isCorrect, correctPlayerIds: currentVideo.correctPlayerIds });
    });

    socket.on("next-video", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.players[0].id !== socket.id) return;

      if (room.currentVideoIndex < room.videos.length - 1) {
        room.currentVideoIndex++;
        io.to(cleanCode).emit("next-video", { currentVideoIndex: room.currentVideoIndex });
      } else {
        room.status = 'results';
        io.to(cleanCode).emit("game-ended", room);
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomCode) => {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
          if (room.players.length === 0) {
            rooms.delete(roomCode);
          } else {
            if (playerIndex === 0) {
              room.players[0].isHost = true;
            }
            io.to(roomCode).emit("room-updated", room);
          }
        }
      });
    });
  });

  expressApp.all("*", (req: any, res: any) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Always bind to 0.0.0.0 so that it works behind NAT on Oracle VPS
  server.listen(port, bindHostname, () => {
    console.log(`> Ready on http://${publicHostname}:${port}`);
    console.log(`> Listening internally on all interfaces (${bindHostname}:${port})`);
  });
});
