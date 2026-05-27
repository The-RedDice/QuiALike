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
import * as cheerio from "cheerio";

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

  // Simple TikTok Profile Scraper (Bypasses OAuth)
  expressApp.get("/api/profile/:username", async (req, res) => {
    let { username } = req.params;

    // Clean up username if they included the @ symbol
    if (username.startsWith('@')) {
      username = username.substring(1);
    }

    // Fallback generic avatar
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${username}&background=random&color=fff&size=200`;

    try {
      // Attempt to scrape the public TikTok profile
      const response = await axios.get(`https://www.tiktok.com/@${username}`, {
        headers: {
          // Emulate a standard browser to reduce blocking chances
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        timeout: 5000 // Don't hang forever if TikTok is blocking us
      });

      const $ = cheerio.load(response.data);
      // TikTok usually stores the profile picture in the og:image meta tag
      let avatar = $('meta[property="og:image"]').attr('content');

      if (!avatar || avatar.includes('tiktok_logo')) {
        avatar = fallbackAvatar;
      }

      res.json({
        username: username,
        avatar: avatar
      });

    } catch (error) {
      console.warn(`Failed to scrape avatar for @${username}, using fallback.`);
      // If TikTok blocks us (403, Captcha, timeout), gracefully fail and use the fallback
      res.json({
        username: username,
        avatar: fallbackAvatar
      });
    }
  });

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);
    socket.on("create-room", (userData: { username: string, avatar: string }) => {
      console.log("Create room requested by:", userData.username);
      const roomCode = nanoid(6).toUpperCase();
      const host: Player = {
        id: userData.username, // Stable ID
        socketId: socket.id,
        username: userData.username,
        avatar: userData.avatar,
        score: 0,
        isHost: true,
        hasSubmittedVideos: false
      };

      const room: Room = {
        code: roomCode,
        players: [host],
        status: 'lobby',
        currentVideoIndex: 0,
        videos: [],
        settings: {
          videosPerPlayer: 2
        },
        currentVotes: {}
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

      // Check if player already exists in the room
      const existingPlayer = room.players.find(p => p.username === userData.username);

      if (existingPlayer) {
          // Reconnect logic: update their socket ID
          existingPlayer.socketId = socket.id;
          existingPlayer.offline = false;
          socket.join(cleanCode);

          // If the game has already started, emit the current state directly to the reconnecting player
          if (room.status === 'playing') {
             socket.emit("game-started", room);
          } else if (room.status === 'results') {
             socket.emit("game-started", room);
             socket.emit("results-revealed", {
                 results: room.currentVotes,
                 correctPlayerIds: room.videos[room.currentVideoIndex].correctPlayerIds,
                 players: room.players
             });
          } else if (room.status === 'ended') {
             socket.emit("game-ended", room);
          }

          io.to(cleanCode).emit("room-updated", room);
          return;
      }

      if (room.status !== 'lobby') {
        socket.emit("error", "La partie a déjà commencé");
        return;
      }

      const player: Player = {
        id: userData.username,
        socketId: socket.id,
        username: userData.username,
        avatar: userData.avatar,
        score: 0,
        isHost: false,
        hasSubmittedVideos: false
      };
      room.players.push(player);

      socket.join(cleanCode);
      io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("submit-videos", async ({ roomCode, videoUrls, username }: { roomCode: string, videoUrls: string[], username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.status !== 'lobby') return;

      // Identify player by stable username to prevent issues if socket.id is somehow mismatched on reconnect
      const player = room.players.find(p => p.username === username);
      if (!player) {
         console.error("Player not found when submitting videos:", username);
         return;
      }

      // Update their socketId just in case it was out of sync
      player.socketId = socket.id;

      player.hasSubmittedVideos = true;

      for (let i = 0; i < videoUrls.length; i++) {
        let url = videoUrls[i];
        let videoId: string | undefined;

        // Try to extract videoId if it's a shortlink
        if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
           try {
              const res = await fetch(url, { redirect: 'manual' });
              const location = res.headers.get('location');
              if (location) {
                  url = location;
              } else if (res.url && res.url !== url) {
                  // Fallback for some fetch implementations
                  url = res.url;
              }
           } catch (e) {
              console.warn("Failed to resolve shortlink", url, e);
           }
        }

        // Try to extract videoId
        const match = url.match(/video\/(\d+)/);
        if (match && match[1]) {
           videoId = match[1];
        }

        room.videos.push({
          id: `${socket.id}-video-${i}`,
          url: url,
          videoId,
          thumbnail: "", // Oembed or meta tags could fetch this, keeping empty for simplicity
          correctPlayerIds: [player.id]
        });
      }

      io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("start-game", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.players[0].socketId !== socket.id) return;

      // Check if everyone has submitted their videos
      const allSubmitted = room.players.every(p => p.hasSubmittedVideos);
      if (!allSubmitted) {
         socket.emit("error", "Tous les joueurs n'ont pas encore soumis leurs vidéos !");
         return;
      }

      if (room.videos.length === 0) {
         socket.emit("error", "Aucune vidéo n'a été soumise !");
         return;
      }

      room.status = 'playing';
      room.currentVideoIndex = 0;
      room.videos.sort(() => 0.5 - Math.random()); // Shuffle the videos
      room.currentVotes = {};
      room.videoStartTime = Date.now();
      io.to(cleanCode).emit("game-started", room);
    });

    socket.on("submit-vote", ({ roomCode, targetPlayerId, timeTaken, username }: { roomCode: string, targetPlayerId: string, timeTaken: number, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.status !== 'playing') return;

      const votingPlayer = room.players.find(p => p.username === username);
      if (!votingPlayer) return;

      // Update their socketId just in case it was out of sync
      votingPlayer.socketId = socket.id;

      const currentVideo = room.videos[room.currentVideoIndex];
      const isCorrect = currentVideo.correctPlayerIds.includes(targetPlayerId);

      // Calculate server-authoritative time if not perfectly provided
      const actualTimeTaken = room.videoStartTime ? Date.now() - room.videoStartTime : timeTaken;

      // Save the vote using stable player ID
      room.currentVotes[votingPlayer.id] = { targetPlayerId, isCorrect, timeTaken: actualTimeTaken };

      if (isCorrect) {
        // Score based on speed (max 1000 points, min 100)
        const points = Math.max(100, Math.floor(1000 * (1 - actualTimeTaken / 30000)));
        votingPlayer.score += points;
      }

      // Notify others that someone voted to show loader/count
      io.to(cleanCode).emit("player-voted");

      // Check if everyone has voted
      if (Object.keys(room.currentVotes).length === room.players.length) {
        io.to(cleanCode).emit("results-revealed", {
            results: room.currentVotes,
            correctPlayerIds: currentVideo.correctPlayerIds,
            players: room.players // Pass updated players with new scores
        });
      }
    });

    socket.on("reveal-results", (roomCode: string) => {
        const cleanCode = roomCode.toUpperCase();
        const room = rooms.get(cleanCode);
        if (!room || room.status !== 'playing') return;

        const currentVideo = room.videos[room.currentVideoIndex];
        io.to(cleanCode).emit("results-revealed", {
            results: room.currentVotes,
            correctPlayerIds: currentVideo.correctPlayerIds,
            players: room.players // Pass updated players with new scores
        });
    });

    socket.on("next-video", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room || room.players[0].socketId !== socket.id) return;

      if (room.currentVideoIndex < room.videos.length - 1) {
        room.currentVideoIndex++;
        room.currentVotes = {};
        room.videoStartTime = Date.now();
        room.status = 'playing'; // explicitly set to playing for next round sync
        // Emit full room-updated to ensure currentVotes state is synced across clients
        io.to(cleanCode).emit("room-updated", room);
        io.to(cleanCode).emit("next-video", { currentVideoIndex: room.currentVideoIndex, videoStartTime: room.videoStartTime });
      } else {
        room.status = 'results';
        io.to(cleanCode).emit("game-ended", room);
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomCode) => {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) {
          player.offline = true;
          // Check if EVERYONE is offline
          const allOffline = room.players.every(p => p.offline);
          if (allOffline) {
            // Keep room alive momentarily for refresh/reconnect
          }
          io.to(roomCode).emit("room-updated", room);
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
