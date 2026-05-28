/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { nanoid } from "nanoid";
import { Room, Player, Video } from "./src/types";
import dotenv from "dotenv";

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



const rooms: Map<string, Room> = new Map();

app.prepare().then(() => {
  const expressApp = express();
  expressApp.use(cookieParser());
  const server = createServer(expressApp);
  const io = new Server(server);

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);
    socket.on("create-room", ({ gameType = "quialike", ...userData }: { username: string, avatar: string, gameType?: "quialike" | "imitmeme" }) => {
      console.log(`Create ${gameType} room requested by:`, userData.username);
      const roomCode = nanoid(6).toUpperCase();
      const host: Player = {
        id: userData.username,
        socketId: socket.id,
        username: userData.username,
        avatar: userData.avatar,
        score: 0,
        isHost: true,
        hasSubmittedVideos: false
      };

      let room: any;
      if (gameType === 'imitmeme') {
        room = {
          code: roomCode,
          gameType: 'imitmeme',
          players: [host],
          status: 'lobby',
          currentMemeIndex: 0,
          memes: [],
          settings: {
            memesPerPlayer: 1
          },
          currentVotes: {}
        };
      } else {
        room = {
          code: roomCode,
          gameType: 'quialike',
          players: [host],
          status: 'lobby',
          currentVideoIndex: 0,
          videos: [],
          settings: {
            videosPerPlayer: 2
          },
          currentVotes: {}
        };
      }

      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.emit("room-created", room);
      console.log("Room created:", roomCode);
    });

    socket.on("join-room", (roomCode: string, userData: { username: string, avatar: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room) {
        socket.emit("error", "Salle non trouvée");
        return;
      }

      // Check if player already exists in the room
      const existingPlayer = room.players.find((p: any) => p.username === userData.username);

      if (existingPlayer) {
          // Reconnect logic: update their socket ID
          existingPlayer.socketId = socket.id;
          existingPlayer.offline = false;
          socket.join(cleanCode);

          // If the game has already started, emit the current state directly to the reconnecting player
          if (room.gameType === 'quialike' || !room.gameType) {
            const qRoom = room as any;
            if (qRoom.status === 'playing') {
               socket.emit("game-started", qRoom);
            } else if (qRoom.status === 'results') {
               socket.emit("game-started", qRoom);
               socket.emit("results-revealed", {
                   results: qRoom.currentVotes,
                   correctPlayerIds: qRoom.videos[qRoom.currentVideoIndex].correctPlayerIds,
                   players: qRoom.players
               });
            } else if (qRoom.status === 'ended') {
               socket.emit("game-ended", qRoom);
            }
          } else if (room.gameType === 'imitmeme') {
            const iRoom = room as any;
            if (['playing_meme', 'recording', 'listening', 'voting', 'results', 'leaderboard'].includes(iRoom.status)) {
               socket.emit("imitmeme-game-started", iRoom);
            } else if (iRoom.status === 'ended') {
               socket.emit("game-ended", iRoom);
            }
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
      const room = rooms.get(cleanCode) as any;
      if (!room || room.status !== 'lobby') return;

      // Identify player by stable username to prevent issues if socket.id is somehow mismatched on reconnect
      const player = room.players.find((p: any) => p.username === username);
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
        let platform: 'tiktok' | 'instagram' | 'youtube' | 'unknown' = 'unknown';

        if (url.includes('tiktok.com')) {
          platform = 'tiktok';
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
        } else if (url.includes('instagram.com/reel') || url.includes('instagram.com/p/')) {
          platform = 'instagram';
          const match = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
          if (match && match[1]) {
             videoId = match[1];
          }
        } else if (url.includes('youtube.com/shorts/') || url.includes('youtu.be/')) {
          platform = 'youtube';
          const match = url.match(/(?:shorts\/|youtu\.be\/)([A-Za-z0-9_-]+)/);
          if (match && match[1]) {
             videoId = match[1];
          }
        }

        room.videos.push({
          id: `${socket.id}-video-${i}`,
          url: url,
          videoId,
          platform,
          thumbnail: "", // Oembed or meta tags could fetch this, keeping empty for simplicity
          correctPlayerIds: [player.id]
        });
      }

      io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("start-game", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.players[0].socketId !== socket.id) return;

      // Check if everyone has submitted their videos
      const allSubmitted = room.players.every((p: any) => p.hasSubmittedVideos);
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

      // Better shuffle algorithm (Fisher-Yates) to prevent repeating videos
      for (let i = room.videos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [room.videos[i], room.videos[j]] = [room.videos[j], room.videos[i]];
      }

      room.currentVotes = {};
      room.previousScores = {};
      room.players.forEach((p: any) => {
          room.previousScores![p.id] = p.score;
      });

      room.playersLoadedVideo = [];
      // videoStartTime will be set when all players load the video
      room.videoStartTime = undefined;
      io.to(cleanCode).emit("game-started", room);
    });

    socket.on("video-loaded", ({ roomCode, username }: { roomCode: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.status !== 'playing') return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      if (!room.playersLoadedVideo) room.playersLoadedVideo = [];
      if (!room.playersLoadedVideo.includes(player.id)) {
        room.playersLoadedVideo.push(player.id);
      }

      // Check if all connected players have loaded the video
      const activePlayers = room.players.filter((p: any) => !p.offline);
      if (room.playersLoadedVideo.length >= activePlayers.length) {
         room.videoStartTime = Date.now();
         io.to(cleanCode).emit("start-voting", { videoStartTime: room.videoStartTime });
      }
    });

    socket.on("submit-vote", ({ roomCode, targetPlayerId, timeTaken, username }: { roomCode: string, targetPlayerId: string, timeTaken: number, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.status !== 'playing') return;

      const votingPlayer = room.players.find((p: any) => p.username === username);
      if (!votingPlayer) return;

      const currentVideo = room.videos[room.currentVideoIndex];

      // Prevent the owner of the video from voting, and prevent voting for oneself
      if (currentVideo.correctPlayerIds.includes(votingPlayer.id) || votingPlayer.id === targetPlayerId) {
        return;
      }

      // Update their socketId just in case it was out of sync
      votingPlayer.socketId = socket.id;

      const isCorrect = currentVideo.correctPlayerIds.includes(targetPlayerId);

      // Calculate server-authoritative time if not perfectly provided
      const actualTimeTaken = room.videoStartTime ? Date.now() - room.videoStartTime : timeTaken;

      // Save the vote using stable player ID
      room.currentVotes[votingPlayer.id] = { targetPlayerId, isCorrect, timeTaken: actualTimeTaken };

      if (isCorrect) {
        // Score based on speed, tighter range: max 1000 points, min 800
        const points = Math.max(800, Math.floor(1000 - (actualTimeTaken / 30000) * 200));
        votingPlayer.score += points;
      }

      // Notify others that someone voted to show loader/count
      io.to(cleanCode).emit("player-voted");

      // Check if everyone (who is allowed to vote) has voted
      const expectedVoters = room.players.filter((p: any) => !currentVideo.correctPlayerIds.includes(p.id)).length;
      if (Object.keys(room.currentVotes).length >= expectedVoters) {
        io.to(cleanCode).emit("results-revealed", {
            results: room.currentVotes,
            correctPlayerIds: currentVideo.correctPlayerIds,
            players: room.players // Pass updated players with new scores
        });
      }
    });

    socket.on("reveal-results", (roomCode: string) => {
        const cleanCode = roomCode.toUpperCase();
        const room = rooms.get(cleanCode) as any;
        if (!room || room.status !== 'playing') return;

        const currentVideo = room.videos[room.currentVideoIndex];
        io.to(cleanCode).emit("results-revealed", {
            results: room.currentVotes,
            correctPlayerIds: currentVideo.correctPlayerIds,
            players: room.players // Pass updated players with new scores
        });
    });

    socket.on("show-leaderboard", (roomCode: string) => {
        const cleanCode = roomCode.toUpperCase();
        const room = rooms.get(cleanCode) as any;
        if (!room || room.players[0].socketId !== socket.id) return;

        room.status = 'leaderboard';
        io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("next-video", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.players[0].socketId !== socket.id) return;

      if (room.currentVideoIndex < room.videos.length - 1) {
        room.currentVideoIndex++;
        room.currentVotes = {};

        room.previousScores = {};
        room.players.forEach((p: any) => {
            room.previousScores![p.id] = p.score;
        });

        room.playersLoadedVideo = [];
        room.videoStartTime = undefined;
        room.status = 'playing'; // explicitly set to playing for next round sync
        // Emit full room-updated to ensure currentVotes state is synced across clients
        io.to(cleanCode).emit("room-updated", room);
        io.to(cleanCode).emit("next-video", { currentVideoIndex: room.currentVideoIndex, videoStartTime: room.videoStartTime });
      } else {
        room.status = 'ended';
        io.to(cleanCode).emit("game-ended", room);
      }
    });


    socket.on("leave-room", (roomCode: string) => {
      const room = rooms.get(roomCode) as any;
      if (!room) return;

      const playerIndex = room.players.findIndex((p: any) => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        socket.leave(roomCode);

        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          // If the host left, assign host to the next player
          if (player.isHost) {
            room.players[0].isHost = true;
          }
          io.to(roomCode).emit("room-updated", room);
        }
      }
    });


    socket.on("submit-imitmeme-meme", async ({ roomCode, url, fileBase64, duration, username }: { roomCode: string, url: string, fileBase64?: string, duration: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'lobby') return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      player.socketId = socket.id;
      player.hasSubmittedVideos = true;

      let platform: 'tiktok' | 'youtube' | 'unknown' = 'unknown';
      let videoId = undefined;

      if (url && url.includes('tiktok.com')) {
        platform = 'tiktok';
        if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
           try {
              const res = await fetch(url, { redirect: 'manual' });
              const location = res.headers.get('location');
              if (location) {
                  url = location;
              } else if (res.url && res.url !== url) {
                  url = res.url;
              }
           } catch (e) {}
        }
        const match = url.match(/video\/(\d+)/);
        if (match && match[1]) {
           videoId = match[1];
        }
      } else if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
         platform = 'youtube';
         // Match standard watch?v=, youtu.be/, shorts/, and mobile links
         const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
         if (ytMatch && ytMatch[1]) {
             videoId = ytMatch[1];
         }
      }

      room.memes.push({
        id: `${socket.id}-meme-${Date.now()}`,
        url: url || '',
        fileBase64,
        platform,
        videoId,
        duration: parseInt(duration, 10) || 15,
        submitterId: player.id,
        recordings: {}
      });

      io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("start-imitmeme-game", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.players[0].socketId !== socket.id) return;

      const allSubmitted = room.players.every((p: any) => p.hasSubmittedVideos);
      if (!allSubmitted) {
         socket.emit("error", "Tous les joueurs n'ont pas encore soumis de mème !");
         return;
      }
      if (room.memes.length === 0) {
         socket.emit("error", "Aucun mème n'a été soumis !");
         return;
      }

      room.status = 'playing_meme';
      room.currentMemeIndex = 0;

      for (let i = room.memes.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [room.memes[i], room.memes[j]] = [room.memes[j], room.memes[i]];
      }

      room.currentVotes = {};
      room.previousScores = {};
      room.players.forEach((p: any) => {
          room.previousScores[p.id] = p.score;
      });

      room.playersLoadedMeme = [];
      room.memeStartTime = undefined;
      io.to(cleanCode).emit("imitmeme-game-started", room);
    });

    socket.on("meme-loaded", ({ roomCode, username }: { roomCode: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'playing_meme') return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      if (!room.playersLoadedMeme) room.playersLoadedMeme = [];
      if (!room.playersLoadedMeme.includes(player.id)) {
        room.playersLoadedMeme.push(player.id);
      }

      const activePlayers = room.players.filter((p: any) => !p.offline);
      if (room.playersLoadedMeme.length >= activePlayers.length) {
         room.memeStartTime = Date.now();
         io.to(cleanCode).emit("start-playing-meme", { memeStartTime: room.memeStartTime });
      }
    });

    socket.on("start-recording-phase", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'playing_meme') return;
      if (room.players[0].socketId !== socket.id) return;

      room.status = 'recording';
      room.playersReadyForRecording = [];
      io.to(cleanCode).emit("recording-phase-started", room);
    });

    socket.on("submit-recording", ({ roomCode, username, audioBase64 }: { roomCode: string, username: string, audioBase64: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'recording') return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      const currentMeme = room.memes[room.currentMemeIndex];
      if (currentMeme) {
          currentMeme.recordings[player.id] = audioBase64;
      }

      if (!room.playersReadyForRecording) room.playersReadyForRecording = [];
      if (!room.playersReadyForRecording.includes(player.id)) {
         room.playersReadyForRecording.push(player.id);
      }

      io.to(cleanCode).emit("player-recorded");

      const expectedRecordings = room.players.length;
      if (room.playersReadyForRecording.length >= expectedRecordings) {
         room.status = 'listening';
         io.to(cleanCode).emit("listening-phase-started", room);
      }
    });

    socket.on("play-next-recording", ({ roomCode, targetPlayerId }: { roomCode: string, targetPlayerId: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'listening') return;
      if (room.players[0].socketId !== socket.id) return;

      room.currentlyPlayingRecordingId = targetPlayerId;
      io.to(cleanCode).emit("play-recording", { targetPlayerId });
    });

    socket.on("start-voting-phase", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'listening') return;
      if (room.players[0].socketId !== socket.id) return;

      room.status = 'voting';
      io.to(cleanCode).emit("voting-phase-started", room);
    });

    socket.on("submit-imitmeme-vote", ({ roomCode, targetPlayerId, username }: { roomCode: string, targetPlayerId: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.status !== 'voting') return;

      const voter = room.players.find((p: any) => p.username === username);
      if (!voter) return;

      if (voter.id === targetPlayerId) return;

      room.currentVotes[voter.id] = targetPlayerId;
      io.to(cleanCode).emit("player-voted");

      const expectedVoters = room.players.length;
      if (Object.keys(room.currentVotes).length >= expectedVoters) {
         // Proportional scoring: say total votes = x. Each vote = 300 points.
         Object.values(room.currentVotes).forEach((votedId: any) => {
             const votedPlayer = room.players.find((p: any) => p.id === votedId);
             if (votedPlayer) votedPlayer.score += 300;
         });
         room.status = 'results';
         io.to(cleanCode).emit("imitmeme-results-revealed", {
            results: room.currentVotes,
            players: room.players
         });
      }
    });

    socket.on("next-meme", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'imitmeme' || room.players[0].socketId !== socket.id) return;

      if (room.currentMemeIndex < room.memes.length - 1) {
        room.currentMemeIndex++;
        room.currentVotes = {};
        room.previousScores = {};
        room.players.forEach((p: any) => {
            room.previousScores[p.id] = p.score;
        });
        room.playersLoadedMeme = [];
        room.playersReadyForRecording = [];
        room.memeStartTime = undefined;
        room.status = 'playing_meme';
        io.to(cleanCode).emit("room-updated", room);
        io.to(cleanCode).emit("next-meme", { currentMemeIndex: room.currentMemeIndex });
      } else {
        room.status = 'ended';
        io.to(cleanCode).emit("game-ended", room);
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomCode) => {
        const player = room.players.find((p: any) => p.socketId === socket.id);
        if (player) {
          player.offline = true;
          // Check if EVERYONE is offline
          const allOffline = room.players.every((p: any) => p.offline);
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
