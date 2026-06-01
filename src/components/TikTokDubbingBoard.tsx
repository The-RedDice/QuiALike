/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @next/next/no-img-element, react/no-unescaped-entities */
"use client";

import { useState, useEffect, useRef } from "react";
import { TikTokDubbingRoom, Player } from "@/types";
import { Socket } from "socket.io-client";
import { Users, Mic, Play, Award } from "lucide-react";
import { motion } from "framer-motion";
import { useChatBubbles, ChatBubble } from "./ChatBubble";

interface Props {
  room: TikTokDubbingRoom;
  user: Player;
  socket: Socket;
}

export default function TikTokDubbingBoard({ room, user, socket }: Props) {
  const currentVideo = room.videos[room.currentVideoIndex];

  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(currentVideo?.duration || 15);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const chatBubbles = useChatBubbles(socket);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                  const base64Audio = reader.result as string;
                  socket.emit("submit-dubbing-recording", {
                      roomCode: room.code,
                      username: user.username,
                      audioBase64: base64Audio
                  });
              };
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
      } catch (err) {
          console.error("Error accessing microphone:", err);
          alert("Impossible d'accéder au microphone.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  useEffect(() => {
      if (room.status === 'playing_video') {
          setTimeLeft(5); // Countdown before recording starts
          const timer = setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 1) {
                      clearInterval(timer);
                      if (user.isHost) socket.emit("start-dubbing-recording-phase", room.code);
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
          return () => clearInterval(timer);
      }

      if (room.status === 'recording') {
          setTimeLeft(currentVideo?.duration || 15);
          startRecording();
          const timer = setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 1) {
                      clearInterval(timer);
                      stopRecording();
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
          return () => {
              clearInterval(timer);
              stopRecording();
          };
      }
  }, [room.status, currentVideo?.duration]);

  useEffect(() => {
      if (room.status === 'listening' && room.currentlyPlayingRecordingId) {
          const recordingBase64 = currentVideo.recordings[room.currentlyPlayingRecordingId];
          if (recordingBase64) {
              if (audioPlayerRef.current) {
                  audioPlayerRef.current.pause();
              }
              const audio = new Audio(recordingBase64);
              audioPlayerRef.current = audio;
              setIsPlayingRecording(true);

              audio.onended = () => setIsPlayingRecording(false);
              audio.play().catch(e => console.error("Error playing dubbing:", e));
          }
      }
      return () => {
          if (audioPlayerRef.current) {
              audioPlayerRef.current.pause();
          }
      };
  }, [room.currentlyPlayingRecordingId, room.status]);

  if (room.status === 'voting') {
      const hasVoted = !!room.currentVotes[user.id];
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-black bg-[#c0c0c0]">
              <h2 className="text-5xl font-black italic mb-8 uppercase tracking-tighter text-[#00f2fe]">Votez !</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl w-full">
                  {room.players.map(p => {
                      if (p.id === user.id) return null;
                      const isVoted = room.currentVotes[user.id] === p.id;
                      return (
                          <button
                              key={p.id}
                              disabled={hasVoted}
                              onClick={() => socket.emit("submit-tiktokdubbing-vote", { roomCode: room.code, targetPlayerId: p.id, username: user.username })}
                              className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${hasVoted ? (isVoted ? 'bg-[#fe2c55] border-[#fe2c55] scale-105' : 'bg-[#c0c0c0]/5 border-white/10 opacity-50') : 'bg-[#c0c0c0] border-white/10 hover:border-[#fe2c55] hover:scale-105'}`}
                          >
                              <img src={p.avatar} className="w-20 h-20 rounded-full" alt={p.username} />
                              <span className="font-bold text-xl">{p.username}</span>
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  }

  if (room.status === 'results') {
      const nextVideo = () => socket.emit("next-dubbing-video", room.code);

      const voteCounts: Record<string, number> = {};
      Object.values(room.currentVotes).forEach(votedId => {
          voteCounts[votedId as string] = (voteCounts[votedId as string] || 0) + 1;
      });

      const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-black bg-[#c0c0c0]">
              <h2 className="text-5xl font-black italic mb-12 uppercase tracking-tighter text-[#fe2c55]">Résultats</h2>
              <div className="w-full max-w-2xl space-y-4">
                  {sortedPlayers.map((p, i) => {
                      const gainedVotes = voteCounts[p.id] || 0;
                      return (
                          <div key={p.id} className="bg-[#c0c0c0] p-6 rounded-3xl flex items-center justify-between border border-white/10">
                              <div className="flex items-center gap-4">
                                  <div className="text-2xl font-black text-[#404040] w-8">{i + 1}</div>
                                  <img src={p.avatar} className="w-12 h-12 rounded-full" alt={p.username} />
                                  <span className="font-bold text-xl">{p.username}</span>
                              </div>
                              <div className="flex items-center gap-6">
                                  {gainedVotes > 0 && <span className="text-green-400 font-bold">+{gainedVotes} votes</span>}
                                  <span className="text-2xl font-black text-[#00f2fe]">{p.score} pts</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
              {user.isHost && (
                  <button onClick={nextVideo} className="mt-12 px-8 py-4 bg-[#c0c0c0] text-black font-black text-xl rounded-2xl hover:scale-105 transition-transform">
                      {room.currentVideoIndex < room.videos.length - 1 ? 'VIDÉO SUIVANTE' : 'TERMINER'}
                  </button>
              )}
          </div>
      );
  }

  return (
      <div className="flex flex-col items-center min-h-screen p-4 bg-[#c0c0c0] text-black">
          <div className="w-full max-w-4xl mt-6">
              <div className="flex justify-between items-center mb-8 bg-[#c0c0c0] p-4 rounded-2xl border border-white/10">
                  <div className="flex gap-4">
                      {room.players.map(p => (
                          <div key={p.id} className="relative">
                              <img src={p.avatar} className={`w-10 h-10 rounded-full ${room.playersReadyForRecording?.includes(p.id) ? 'ring-2 ring-green-500' : ''}`} alt={p.username} />
                              {chatBubbles[p.username] && <ChatBubble text={chatBubbles[p.username].text} />}
                          </div>
                      ))}
                  </div>
                  <div className="font-bold text-xl tracking-widest text-[#00f2fe]">
                      VIDÉO {room.currentVideoIndex + 1}/{room.videos.length}
                  </div>
              </div>

              <div className="relative w-full aspect-[9/16] max-h-[60vh] max-w-sm mx-auto bg-black rounded-3xl overflow-hidden border-4 border-[#18181b] shadow-2xl">
                  {currentVideo?.platform === 'tiktok' && currentVideo.videoId ? (
                      <iframe
                          src={`https://www.tiktok.com/embed/v2/${currentVideo.videoId}?lang=fr-FR&autoplay=1&mute=1`}
                          className="w-full h-full border-none pointer-events-none"
                          allow="autoplay"
                      ></iframe>
                  ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#c0c0c0] text-[#404040] p-8 text-center gap-4">
                          <Play size={48} className="opacity-50" />
                          <p className="font-bold">Aperçu vidéo indisponible</p>
                          <a href={currentVideo?.url} target="_blank" className="text-xs text-[#00f2fe] underline break-all">{currentVideo?.url}</a>
                      </div>
                  )}

                  {/* Overlays */}
                  {room.status === 'playing_video' && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                          <h3 className="text-2xl font-black uppercase tracking-widest mb-4">Préparez-vous</h3>
                          <div className="text-8xl font-black text-[#fe2c55] animate-pulse">{timeLeft}</div>
                      </div>
                  )}

                  {room.status === 'recording' && (
                      <div className="absolute top-4 right-4 bg-red-500 text-black px-4 py-2 rounded-full font-black animate-pulse flex items-center gap-2 z-10 shadow-lg">
                          <div className="w-3 h-3 bg-[#c0c0c0] rounded-full"></div> REC {timeLeft}s
                      </div>
                  )}

                  {room.status === 'listening' && (
                      <div className="absolute top-4 left-4 right-4 z-10">
                          {room.currentlyPlayingRecordingId ? (() => {
                              const p = room.players.find(pl => pl.id === room.currentlyPlayingRecordingId);
                              return p ? (
                                  <div className="bg-black/80 backdrop-blur-md p-3 rounded-2xl flex items-center gap-3 border border-white/20 animate-in slide-in-from-top-4">
                                      <img src={p.avatar} className="w-10 h-10 rounded-full animate-pulse ring-2 ring-[#00f2fe]" alt={p.username} />
                                      <div>
                                          <p className="text-xs text-[#00f2fe] font-black uppercase tracking-widest">Écoute en cours</p>
                                          <p className="font-bold text-lg leading-none">{p.username}</p>
                                      </div>
                                  </div>
                              ) : null;
                          })() : (
                              <div className="bg-black/80 backdrop-blur-md p-4 rounded-2xl text-center border border-white/20 font-bold animate-pulse">
                                  En attente du lecteur...
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {room.status === 'listening' && user.isHost && (
                  <div className="mt-8 p-6 bg-[#c0c0c0] rounded-3xl border border-white/10 text-center">
                      <h3 className="font-black text-xl mb-4 uppercase tracking-widest text-[#404040]">Contrôle DJ</h3>
                      <div className="flex flex-wrap gap-3 justify-center">
                          {room.players.map(p => (
                              <button
                                  key={p.id}
                                  onClick={() => socket.emit("play-next-dubbing", { roomCode: room.code, targetPlayerId: p.id })}
                                  className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${room.currentlyPlayingRecordingId === p.id ? 'bg-[#00f2fe] text-black scale-105 shadow-[0_0_20px_rgba(0,242,254,0.3)]' : 'bg-[#c0c0c0] border border-white/20 hover:border-[#00f2fe]/50'}`}
                              >
                                  <Play size={16} fill={room.currentlyPlayingRecordingId === p.id ? "black" : "none"} /> {p.username}
                              </button>
                          ))}
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10">
                          <button
                              onClick={() => socket.emit("start-dubbing-voting-phase", room.code)}
                              className="w-full py-4 bg-[#fe2c55] text-black font-black text-lg rounded-xl hover:bg-[#fe2c55]/90 transition-colors shadow-[0_0_20px_rgba(254,44,85,0.3)]"
                          >
                              PASSER AUX VOTES
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
}
