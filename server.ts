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

    // Broadcast total connected users count globally
    io.emit("global-stats", { connectedUsers: io.engine.clientsCount });

    socket.on("create-room", ({ gameType = "quialike", ...userData }: { username: string, avatar: string, gameType?: "quialike" | "imitmeme" | "tiktokdubbing" | "mememaker" }) => {
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
      if (gameType === 'tiktokdubbing') {
        room = {
          code: roomCode,
          gameType: 'tiktokdubbing',
          players: [host],
          status: 'lobby',
          currentVideoIndex: 0,
          videos: [],
          settings: {
            videosPerPlayer: 1
          },
          currentVotes: {}
        };
      } else if (gameType === 'mememaker') {
        room = {
          code: roomCode,
          gameType: 'mememaker',
          players: [host],
          status: 'lobby',
          currentMemeIndex: 0,
          memes: [],
          settings: { gifsPerPlayer: 1 },
          currentVotes: {},
          playersSubmittedCaption: []
        } as any;
      } else if (gameType === 'imitmeme') {
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

      // Prevent duplicate submissions adding to the array infinitely
      if (player.hasSubmittedVideos) {
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

      // videoStartTime is set immediately
      room.videoStartTime = Date.now();
      io.to(cleanCode).emit("game-started", room);
    });

    socket.on("submit-vote", ({ roomCode, targetPlayerId, timeTaken, username }: { roomCode: string, targetPlayerId: string, timeTaken: number, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.status !== 'playing') return;

      const votingPlayer = room.players.find((p: any) => p.username === username);
      if (!votingPlayer) return;

      // Prevent double voting in the same round
      if (room.currentVotes[votingPlayer.id]) {
        return;
      }

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
        // Calculate points for the video owner based on incorrect votes
        // The owner can gain up to 1000 points if EVERYONE is wrong
        const bonusPerError = expectedVoters > 0 ? Math.floor(1000 / expectedVoters) : 0;
        let errorsCount = 0;

        Object.values(room.currentVotes).forEach((vote: any) => {
            if (!vote.isCorrect) errorsCount++;
        });

        if (errorsCount > 0) {
            currentVideo.correctPlayerIds.forEach((ownerId: string) => {
                const owner = room.players.find((p: any) => p.id === ownerId);
                if (owner) {
                    owner.score += (bonusPerError * errorsCount);
                }
            });
        }

        room.status = 'results';
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
        const expectedVoters = room.players.filter((p: any) => !currentVideo.correctPlayerIds.includes(p.id)).length;

        // Calculate points for the video owner based on incorrect votes
        const bonusPerError = expectedVoters > 0 ? Math.floor(1000 / expectedVoters) : 0;
        let errorsCount = 0;

        Object.values(room.currentVotes).forEach((vote: any) => {
            if (!vote.isCorrect) errorsCount++;
        });

        if (errorsCount > 0) {
            currentVideo.correctPlayerIds.forEach((ownerId: string) => {
                const owner = room.players.find((p: any) => p.id === ownerId);
                if (owner) {
                    owner.score += (bonusPerError * errorsCount);
                }
            });
        }

        room.status = 'results';
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

      // Prevent advancing if not currently in leaderboard phase
      // This stops double clicks from skipping rounds or flickering
      if (room.status !== 'leaderboard') return;

      if (room.currentVideoIndex < room.videos.length - 1) {
        room.currentVideoIndex++;
        room.currentVotes = {};

        room.previousScores = {};
        room.players.forEach((p: any) => {
            room.previousScores![p.id] = p.score;
        });

        room.videoStartTime = Date.now();
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

      // Prevent duplicate submissions adding to the array infinitely
      if (player.hasSubmittedVideos) {
         return;
      }

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

      room.memeStartTime = Date.now();
      io.to(cleanCode).emit("imitmeme-game-started", room);
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
      if (room.currentVotes[voter.id]) return; // Prevent double voting

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

      if (room.status !== 'results') return;

      if (room.currentMemeIndex < room.memes.length - 1) {
        room.currentMemeIndex++;
        room.currentVotes = {};
        room.previousScores = {};
        room.players.forEach((p: any) => {
            room.previousScores[p.id] = p.score;
        });
        room.playersReadyForRecording = [];
        room.memeStartTime = Date.now();
        room.status = 'playing_meme';
        io.to(cleanCode).emit("room-updated", room);
        io.to(cleanCode).emit("next-meme", { currentMemeIndex: room.currentMemeIndex });
      } else {
        room.status = 'ended';
        io.to(cleanCode).emit("game-ended", room);
      }
    });

    socket.on("send-chat-bubble", ({ roomCode, text, username }: { roomCode: string, text: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room) return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      // Calculate duration based on text length, min 3s, max 8s
      const duration = Math.min(8000, Math.max(3000, text.length * 100));

      io.to(cleanCode).emit("show-chat-bubble", {
          username: player.username,
          text: text.substring(0, 100), // Max 100 chars
          duration
      });
    });


    // --- TIKTOK DUBBING ---

    socket.on("submit-tiktokdubbing-video", async ({ roomCode, url, duration, username }: { roomCode: string, url: string, duration: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.status !== 'lobby') return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      if (player.hasSubmittedVideos) return;
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
      }

      room.videos.push({
        id: `${socket.id}-video-${Date.now()}`,
        url: url || '',
        platform,
        videoId,
        duration: parseInt(duration, 10) || 15,
        submitterId: player.id,
        recordings: {}
      });

      io.to(cleanCode).emit("room-updated", room);
    });

    socket.on("start-tiktokdubbing-game", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.players[0].socketId !== socket.id) return;

      const allSubmitted = room.players.every((p: any) => p.hasSubmittedVideos);
      if (!allSubmitted) return;

      room.status = 'playing_video';
      room.currentVideoIndex = 0;

      for (let i = room.videos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [room.videos[i], room.videos[j]] = [room.videos[j], room.videos[i]];
      }

      room.currentVotes = {};
      room.previousScores = {};
      room.players.forEach((p: any) => room.previousScores[p.id] = p.score);
      room.videoStartTime = Date.now();
      io.to(cleanCode).emit("tiktokdubbing-game-started", room);
    });

    socket.on("start-dubbing-recording-phase", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.status !== 'playing_video') return;
      if (room.players[0].socketId !== socket.id) return;

      room.status = 'recording';
      room.playersReadyForRecording = [];
      io.to(cleanCode).emit("dubbing-recording-phase-started", room);
    });

    socket.on("submit-dubbing-recording", ({ roomCode, username, audioBase64 }: { roomCode: string, username: string, audioBase64: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.status !== 'recording') return;

      const player = room.players.find((p: any) => p.username === username);
      if (!player) return;

      const currentVideo = room.videos[room.currentVideoIndex];
      if (currentVideo) {
          currentVideo.recordings[player.id] = audioBase64;
      }

      if (!room.playersReadyForRecording) room.playersReadyForRecording = [];
      if (!room.playersReadyForRecording.includes(player.id)) {
         room.playersReadyForRecording.push(player.id);
      }

      io.to(cleanCode).emit("player-dubbing-recorded");

      if (room.playersReadyForRecording.length >= room.players.length) {
         room.status = 'listening';
         io.to(cleanCode).emit("dubbing-listening-phase-started", room);
      }
    });

    socket.on("play-next-dubbing", ({ roomCode, targetPlayerId }: { roomCode: string, targetPlayerId: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.status !== 'listening') return;
      if (room.players[0].socketId !== socket.id) return;

      room.currentlyPlayingRecordingId = targetPlayerId;
      io.to(cleanCode).emit("play-dubbing", { targetPlayerId });
    });

    socket.on("start-dubbing-voting-phase", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.status !== 'listening') return;
      if (room.players[0].socketId !== socket.id) return;

      room.status = 'voting';
      io.to(cleanCode).emit("dubbing-voting-phase-started", room);
    });

    socket.on("submit-tiktokdubbing-vote", ({ roomCode, targetPlayerId, username }: { roomCode: string, targetPlayerId: string, username: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.status !== 'voting') return;

      const voter = room.players.find((p: any) => p.username === username);
      if (!voter || voter.id === targetPlayerId || room.currentVotes[voter.id]) return;

      room.currentVotes[voter.id] = targetPlayerId;
      io.to(cleanCode).emit("player-dubbing-voted");

      if (Object.keys(room.currentVotes).length >= room.players.length) {
         Object.values(room.currentVotes).forEach((votedId: any) => {
             const votedPlayer = room.players.find((p: any) => p.id === votedId);
             if (votedPlayer) votedPlayer.score += 300;
         });
         room.status = 'results';
         io.to(cleanCode).emit("tiktokdubbing-results-revealed", {
            results: room.currentVotes,
            players: room.players
         });
      }
    });

    socket.on("next-dubbing-video", (roomCode: string) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode) as any;
      if (!room || room.gameType !== 'tiktokdubbing' || room.players[0].socketId !== socket.id) return;

      if (room.status !== 'results') return;

      if (room.currentVideoIndex < room.videos.length - 1) {
        room.currentVideoIndex++;
        room.currentVotes = {};
        room.previousScores = {};
        room.players.forEach((p: any) => room.previousScores[p.id] = p.score);
        room.playersReadyForRecording = [];
        room.videoStartTime = Date.now();
        room.status = 'playing_video';
        io.to(cleanCode).emit("room-updated", room);
        io.to(cleanCode).emit("next-dubbing-video", { currentVideoIndex: room.currentVideoIndex });
      } else {
        room.status = 'ended';
        io.to(cleanCode).emit("game-ended", room);
      }
    });

    socket.on("send-reaction", ({ roomCode, emoji }: { roomCode: string, emoji: string }) => {
      const cleanCode = roomCode.toUpperCase();
      const room = rooms.get(cleanCode);
      if (!room) return;
      io.to(cleanCode).emit("show-reaction", { emoji });
    });

    // === GAME LOGIC FOR MEMEMAKER ===
    socket.on("mememaker-submit-gif", (roomCode: string, gifUrl: string) => {
      const room = rooms.get(roomCode);
      if (!room || room.gameType !== 'mememaker') return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      const memeMakerRoom = room as any;

      memeMakerRoom.memes.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        gifUrl: gifUrl,
        submitterId: player.id,
        captions: {}
      });

      player.hasSubmittedVideos = true;
      io.to(roomCode).emit("room-update", room);
    });

    socket.on("mememaker-start-game", (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room || room.gameType !== 'mememaker') return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.isHost) return;

      const memeMakerRoom = room as any;
      memeMakerRoom.status = 'captioning';
      memeMakerRoom.currentMemeIndex = 0;
      memeMakerRoom.playersSubmittedCaption = [];

      for (let i = memeMakerRoom.memes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [memeMakerRoom.memes[i], memeMakerRoom.memes[j]] = [memeMakerRoom.memes[j], memeMakerRoom.memes[i]];
      }

      io.to(roomCode).emit("room-update", room);
    });

    socket.on("mememaker-submit-caption", (roomCode: string, captionData: { text: string; font: string; color: string }) => {
      const room = rooms.get(roomCode);
      if (!room || room.gameType !== 'mememaker') return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      const memeMakerRoom = room as any;
      if (memeMakerRoom.status !== 'captioning') return;

      const currentMeme = memeMakerRoom.memes[memeMakerRoom.currentMemeIndex];
      if (!currentMeme) return;

      currentMeme.captions[player.id] = captionData;

      if (!memeMakerRoom.playersSubmittedCaption.includes(player.id)) {
        memeMakerRoom.playersSubmittedCaption.push(player.id);
      }

      io.to(roomCode).emit("room-update", room);

      if (memeMakerRoom.playersSubmittedCaption.length >= room.players.filter(p => !p.offline).length) {
        memeMakerRoom.status = 'revealing';

        const captionKeys = Object.keys(currentMeme.captions);
        for (let i = captionKeys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [captionKeys[i], captionKeys[j]] = [captionKeys[j], captionKeys[i]];
        }

        memeMakerRoom.revealOrder = captionKeys;
        memeMakerRoom.currentRevealIndex = 0;
        memeMakerRoom.currentlyRevealedCaptionAuthorId = captionKeys[0];
        memeMakerRoom.currentVotes = {};

        io.to(roomCode).emit("room-update", room);
      }
    });

    socket.on("mememaker-next-reveal", (roomCode: string) => {
        const room = rooms.get(roomCode);
        if (!room || room.gameType !== 'mememaker') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        const memeMakerRoom = room as any;
        if (memeMakerRoom.status !== 'revealing') return;

        memeMakerRoom.currentRevealIndex++;

        if (memeMakerRoom.currentRevealIndex < memeMakerRoom.revealOrder.length) {
            memeMakerRoom.currentlyRevealedCaptionAuthorId = memeMakerRoom.revealOrder[memeMakerRoom.currentRevealIndex];
            io.to(roomCode).emit("room-update", room);
        } else {
            memeMakerRoom.status = 'voting';
            memeMakerRoom.currentlyRevealedCaptionAuthorId = null;
            io.to(roomCode).emit("room-update", room);
        }
    });

    socket.on("mememaker-vote", (roomCode: string, votedPlayerId: string) => {
        const room = rooms.get(roomCode);
        if (!room || room.gameType !== 'mememaker') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        const memeMakerRoom = room as any;
        if (memeMakerRoom.status !== 'voting') return;

        memeMakerRoom.currentVotes[player.id] = votedPlayerId;
        io.to(roomCode).emit("room-update", room);

        const activePlayers = room.players.filter(p => !p.offline);
        if (Object.keys(memeMakerRoom.currentVotes).length >= activePlayers.length) {
            memeMakerRoom.status = 'round_results';

            Object.values(memeMakerRoom.currentVotes).forEach(votedId => {
                const votedPlayer = room.players.find(p => p.id === votedId);
                if (votedPlayer) {
                    votedPlayer.score += 100;
                }
            });

            io.to(roomCode).emit("room-update", room);
        }
    });

    socket.on("mememaker-next-round", (roomCode: string) => {
        const room = rooms.get(roomCode);
        if (!room || room.gameType !== 'mememaker') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        const memeMakerRoom = room as any;

        if (memeMakerRoom.currentMemeIndex < memeMakerRoom.memes.length - 1) {
            memeMakerRoom.currentMemeIndex++;
            memeMakerRoom.status = 'captioning';
            memeMakerRoom.playersSubmittedCaption = [];
            memeMakerRoom.currentVotes = {};
            io.to(roomCode).emit("room-update", room);
        } else {
            memeMakerRoom.status = 'leaderboard';
            io.to(roomCode).emit("room-update", room);
        }
    });

    socket.on("disconnect", () => {
      // Update global count
      io.emit("global-stats", { connectedUsers: io.engine.clientsCount });

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
