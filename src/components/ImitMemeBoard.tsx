/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @next/next/no-img-element, react/no-unescaped-entities */
"use client";

import { useState, useEffect, useRef } from "react";
import { ImitMemeRoom, Player } from "@/types";
import { Socket } from "socket.io-client";
import { Users, Mic, Play, Award } from "lucide-react";
import { motion } from "framer-motion";

interface ImitMemeBoardProps {
  room: ImitMemeRoom;
  user: Player;
  socket: Socket;
}

export default function ImitMemeBoard({ room, user, socket }: ImitMemeBoardProps) {
  const currentMeme = room.memes[room.currentMemeIndex];

  // States for recording
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(currentMeme?.duration || 15);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // States for playback
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);


  // States for visualizer
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize Web Audio API for real audio reactivity
  const setupRealVisualizer = (audioElement: HTMLAudioElement) => {
      try {
          if (!audioContextRef.current) {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              audioContextRef.current = new AudioContext();
          }
          if (audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume();
          }
          if (!analyserRef.current) {
              analyserRef.current = audioContextRef.current.createAnalyser();
              analyserRef.current.fftSize = 64; // Small size for ~20 bars
          }
          // Ensure we only create a MediaElementSource once per HTMLMediaElement
          if (!(audioElement as any)._hasAudioSource) {
              const source = audioContextRef.current.createMediaElementSource(audioElement);
              source.connect(analyserRef.current);
              analyserRef.current.connect(audioContextRef.current.destination);
              (audioElement as any)._hasAudioSource = true;
          }

          const updateVisualizer = () => {
              if (analyserRef.current) {
                  const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                  analyserRef.current.getByteFrequencyData(dataArray);

                  // Map frequencies to our 20 levels (0-100%)
                  const step = Math.floor(dataArray.length / 20);
                  for (let i = 0; i < 20; i++) {
                      let sum = 0;
                      for (let j = 0; j < step; j++) {
                          sum += dataArray[i * step + j];
                      }
                      const avg = sum / step;
                      const percent = Math.max(10, (avg / 255) * 100);

                      const bar = barsRef.current[i];
                      if (bar) {
                          bar.style.height = `${percent}%`;
                      }
                  }
              }
              rafRef.current = requestAnimationFrame(updateVisualizer);
          };

          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          updateVisualizer();

      } catch (e) {
          console.error("Visualizer setup failed:", e);
      }
  };

  const stopRealVisualizer = () => {
      if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
      }
      for (let i = 0; i < 20; i++) {
          const bar = barsRef.current[i];
          if (bar) bar.style.height = '10%';
      }
  };

  // Simulated visualizer for iframes (cross-origin audio can't be analyzed)
  useEffect(() => {
      let interval: NodeJS.Timeout;

      // We use simulated if playing a meme that is NOT a local file
      const isSimulatedMeme = room.status === 'playing_meme' && !currentMeme?.fileBase64;

      if (isSimulatedMeme || isRecording) {
          interval = setInterval(() => {
              for (let i = 0; i < 20; i++) {
                  const bar = barsRef.current[i];
                  if (bar) {
                      const currentHeight = parseFloat(bar.style.height || '10');
                      const target = Math.random() * 80 + 10;
                      bar.style.height = `${currentHeight + (target - currentHeight) * 0.5}%`;
                  }
              }
          }, 100);
      } else if (!isPlayingRecording && !(room.status === 'playing_meme' && currentMeme?.fileBase64)) {
          for (let i = 0; i < 20; i++) {
              const bar = barsRef.current[i];
              if (bar) bar.style.height = '10%';
          }
      }
      return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, isRecording, isPlayingRecording, currentMeme]);


  // Track if we already emitted loaded to prevent infinite loops if re-rendered
  const [hasEmittedLoaded, setHasEmittedLoaded] = useState(false);

  useEffect(() => {
      if (room.status === 'playing_meme') {
          if (!hasEmittedLoaded) {
              socket.emit("meme-loaded", { roomCode: room.code, username: user.username });
              setHasEmittedLoaded(true);
          }
          if (room.memeStartTime) {
              const elapsed = Math.floor((Date.now() - room.memeStartTime) / 1000);
              setTimeLeft(Math.max(0, currentMeme.duration - elapsed));
          } else {
              setTimeLeft(currentMeme.duration);
          }
      } else if (room.status === 'recording') {
          setHasEmittedLoaded(false);
          setTimeLeft(currentMeme.duration);
          startRecording();
      } else if (room.status === 'listening') {
          if (room.currentlyPlayingRecordingId) {
             const base64Audio = currentMeme.recordings[room.currentlyPlayingRecordingId];
             if (base64Audio && audioPlayerRef.current) {
                 audioPlayerRef.current.src = base64Audio;
                 audioPlayerRef.current.crossOrigin = "anonymous";
                 audioPlayerRef.current.play().then(() => {
                     setupRealVisualizer(audioPlayerRef.current!);
                 }).catch(e => console.error("Playback failed", e));
                 setIsPlayingRecording(true);
             }
          } else {
             setIsPlayingRecording(false);
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, room.memeStartTime, room.currentlyPlayingRecordingId, currentMeme]);

  useEffect(() => {
      let timer: NodeJS.Timeout;
      if ((room.status === 'playing_meme' && room.memeStartTime) || room.status === 'recording') {
         timer = setInterval(() => {
             setTimeLeft(prev => {
                 if (prev <= 1) {
                     clearInterval(timer);
                     if (room.status === 'playing_meme' && user.isHost) {
                         socket.emit("start-recording-phase", room.code);
                     } else if (room.status === 'recording' && isRecording) {
                         stopRecording();
                     }
                     return 0;
                 }
                 return prev - 1;
             });
         }, 1000);
      }
      return () => clearInterval(timer);
  }, [room.status, room.memeStartTime, isRecording, user.isHost, room.code, socket]);


  const startRecording = async () => {
    try {
      if (!window.isSecureContext) {
          alert("Erreur: L'accès au microphone nécessite une connexion sécurisée (HTTPS).");
          throw new Error("Insecure context");
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Erreur: Votre navigateur ne supporte pas l'enregistrement audio ou le bloque.");
          throw new Error("getUserMedia not supported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            socket.emit("submit-recording", { roomCode: room.code, username: user.username, audioBase64: base64data });
        };
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error accessing mic:", err);
      if (err.message !== "Insecure context" && err.message !== "getUserMedia not supported") {
          alert("Veuillez autoriser l'accès au microphone pour jouer !");
      }
      socket.emit("submit-recording", { roomCode: room.code, username: user.username, audioBase64: "" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVote = (targetPlayerId: string) => {
      socket.emit("submit-imitmeme-vote", { roomCode: room.code, targetPlayerId, username: user.username });
  };


  const renderMemePlayer = () => {
      // Hide video behind a dark overlay, let audio play
      let embedUrl = currentMeme.url;
      if (currentMeme.platform === 'youtube' && currentMeme.videoId) {
          embedUrl = `https://www.youtube.com/embed/${currentMeme.videoId}?autoplay=1&controls=0`;
      } else if (currentMeme.platform === 'tiktok') {
          // TikTok embeds are tricky, might need block iframe
          embedUrl = `https://www.tiktok.com/embed/v2/${currentMeme.videoId}`;
      }

      if (currentMeme.fileBase64) {
          return (
              <div className="relative w-full flex flex-col items-center justify-center p-8 bg-black/50 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                 <audio
                     src={currentMeme.fileBase64}
                     autoPlay
                     controls
                     crossOrigin="anonymous"
                     className="w-full z-40 relative"
                     onPlay={(e) => setupRealVisualizer(e.currentTarget)}
                     onEnded={() => stopRealVisualizer()}
                     onPause={() => stopRealVisualizer()}
                 />

                 {/* Visualizer Background */}
                 <div className="absolute inset-0 flex items-center justify-center gap-1 z-10 bg-black/80 backdrop-blur-sm pointer-events-none">
                     {Array.from({ length: 20 }).map((_, i) => (
                         <div
                            key={i}
                            className="w-2 md:w-3 bg-gradient-to-t from-[#00f2fe] to-[#fe2c55] rounded-full"
                            ref={(el) => { barsRef.current[i] = el; }} style={{ height: "10%" }}

                         />
                     ))}
                 </div>
                 <div className="absolute top-4 right-4 bg-black/50 text-white px-4 py-2 rounded-full font-mono text-xl z-20 font-bold tracking-widest backdrop-blur-md">
                    00:{timeLeft.toString().padStart(2, '0')}
                 </div>
                 {room.status === 'playing_meme' && !room.memeStartTime && (
                     <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md">
                        <span className="text-white font-black animate-pulse text-xl">En attente des joueurs...</span>
                     </div>
                 )}
              </div>
          );
      }

      return (
          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
             {currentMeme.platform === 'tiktok' ? (
                 <iframe src={embedUrl} allow="autoplay; fullscreen" className="absolute w-full h-[120%] -top-[10%] left-0 opacity-0 z-0 pointer-events-none" />
             ) : (
                 <iframe src={embedUrl} allow="autoplay; fullscreen" className="absolute inset-0 w-full h-full opacity-0 z-0 pointer-events-none" />
             )}

             {/* Audio Visualizer Overlay */}
             <div className="absolute inset-0 flex items-center justify-center gap-1 z-10 bg-black/80 backdrop-blur-sm pointer-events-none">
                 {Array.from({ length: 20 }).map((_, i) => (
                     <div
                        key={i}
                        ref={(el) => { barsRef.current[i] = el; }}
                        className="w-2 md:w-3 bg-gradient-to-t from-[#00f2fe] to-[#fe2c55] rounded-full transition-all duration-75"
                        style={{ height: '10%' }}
                     />
                 ))}
             </div>
             <div className="absolute top-4 right-4 bg-black/50 text-white px-4 py-2 rounded-full font-mono text-xl z-20 font-bold tracking-widest backdrop-blur-md">
                00:{timeLeft.toString().padStart(2, '0')}
             </div>
             {room.status === 'playing_meme' && !room.memeStartTime && (
                 <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <span className="text-white font-black animate-pulse text-xl">En attente des joueurs...</span>
                 </div>
             )}
          </div>
      );
  };


  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-8 font-sans flex flex-col items-center overflow-x-hidden">
      <audio ref={audioPlayerRef} onEnded={() => { setIsPlayingRecording(false); stopRealVisualizer(); }} />

      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 relative z-10">
        <div className="flex flex-col">
           <span className="text-[#00f2fe] text-xs font-black uppercase tracking-widest">Imit&apos;Mème</span>
           <span className="text-gray-400 font-medium text-sm">Manche {room.currentMemeIndex + 1}/{room.memes.length}</span>
        </div>
        <div className="px-4 py-2 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/10 shadow-sm backdrop-blur-md">
           <Users size={16} className="text-gray-400" />
           <span className="font-bold">{room.players.length}</span>
        </div>
      </header>

      <main className="w-full max-w-4xl flex-1 flex flex-col items-center relative z-10">

          {/* Phase: Playing Meme */}
          {room.status === 'playing_meme' && (
              <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8">
                  <div className="text-center mb-4">
                      <h2 className="text-3xl font-black italic tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Écoutez bien...</h2>
                      <p className="text-gray-400 font-medium mt-2">Mémorisez l&apos;audio, vous allez devoir l&apos;imiter !</p>
                  </div>
                  {renderMemePlayer()}
              </div>
          )}

          {/* Phase: Recording */}
          {room.status === 'recording' && (
              <div className="w-full flex flex-col items-center justify-center py-20 space-y-12 animate-in zoom-in-95 duration-500">
                  <motion.div
                     animate={{ scale: [1, 1.1, 1] }}
                     transition={{ repeat: Infinity, duration: 1.5 }}
                     className="w-32 h-32 rounded-full bg-[#fe2c55]/20 flex items-center justify-center border-4 border-[#fe2c55] shadow-[0_0_50px_rgba(254,44,85,0.4)]"
                  >
                     <Mic size={48} className="text-[#fe2c55]" />
                  </motion.div>
                  <div className="text-center">
                     <h2 className="text-4xl font-black tracking-tighter uppercase text-white mb-4">À votre tour !</h2>
                     <div className="text-6xl font-mono font-black text-[#fe2c55]">00:{timeLeft.toString().padStart(2, '0')}</div>
                  </div>
              </div>
          )}

          {/* Phase: Listening / Voting */}
          {(room.status === 'listening' || room.status === 'voting') && (
              <div className="w-full space-y-8 animate-in fade-in">
                  <div className="text-center">
                      <h2 className="text-3xl font-black italic tracking-tight uppercase">Les Imitations</h2>
                      <p className="text-gray-400 font-medium mt-2">
                          {room.status === 'listening' ? "Écoutez les chefs-d'œuvre de vos amis" : "Votez pour le meilleur !"}
                      </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {room.players.map(p => {
                          const isCurrentlyPlaying = room.currentlyPlayingRecordingId === p.id;
                          const hasVoted = !!room.currentVotes[user.id];

                          return (
                              <button
                                 key={p.id}
                                 onClick={() => {
                                     if (room.status === 'listening' && user.isHost) {
                                         socket.emit("play-next-recording", { roomCode: room.code, targetPlayerId: p.id });
                                     } else if (room.status === 'voting' && !hasVoted && p.id !== user.id) {
                                         handleVote(p.id);
                                     }
                                 }}
                                 disabled={(room.status === 'voting' && (hasVoted || p.id === user.id)) || (room.status === 'listening' && !user.isHost)}
                                 className={`
                                     relative p-6 rounded-3xl border-2 flex items-center gap-4 transition-all duration-300 overflow-hidden
                                     ${isCurrentlyPlaying ? 'border-[#00f2fe] bg-[#00f2fe]/10 scale-105 shadow-xl shadow-[#00f2fe]/20' : 'border-white/10 bg-[#18181b] hover:border-white/20'}
                                     ${room.status === 'voting' && p.id === user.id ? 'opacity-50 grayscale' : ''}
                                 `}
                              >
                                  {isCurrentlyPlaying && (
                                      <motion.div className="absolute inset-0 bg-[#00f2fe]/5" layoutId="playingHighlight" />
                                  )}

                                  <img src={p.avatar} alt="" className="w-16 h-16 rounded-full ring-2 ring-white/20 relative z-10" />

                                  <div className="flex-1 text-left relative z-10">
                                      <h3 className="font-black text-xl">{p.username}</h3>
                                      {room.status === 'listening' && (
                                          <div className="flex gap-1 mt-2 h-4 items-end">
                                              {isCurrentlyPlaying ? (
                                                  <div className="text-[#00f2fe] text-xs font-bold animate-pulse flex items-center gap-1"><Play size={12} fill="currentColor"/> En écoute...</div>
                                              ) : (
                                                  <div className="text-xs text-gray-500 flex items-center gap-1"><Play size={10}/> En attente</div>
                                              )}
                                          </div>
                                      )}
                                      {room.status === 'voting' && p.id !== user.id && !hasVoted && (
                                          <span className="text-xs font-bold text-[#fe2c55] uppercase tracking-wider mt-1 block">Voter pour lui</span>
                                      )}
                                  </div>
                              </button>
                          );
                      })}
                  </div>

                  {room.status === 'listening' && user.isHost && (
                      <div className="flex justify-center mt-8">
                         <button onClick={() => socket.emit("start-voting-phase", room.code)} className="px-8 py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-transform">
                             PASSER AU VOTE
                         </button>
                      </div>
                  )}
              </div>
          )}

          {/* Phase: Results */}
          {room.status === 'results' && (
              <div className="w-full space-y-8 animate-in zoom-in-95">
                  <div className="text-center mb-10">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Résultats</h2>
                  </div>

                  <div className="space-y-4">
                      {room.players.sort((a,b) => b.score - a.score).map((p, idx) => {
                          const votesReceived = Object.values(room.currentVotes).filter(v => v === p.id).length;
                          const pointsGained = (p.score - (room.previousScores?.[p.id] || 0));

                          return (
                              <div key={p.id} className="bg-white/10 p-4 rounded-3xl flex items-center gap-4">
                                  <div className="text-2xl font-black text-gray-500 w-8 text-center">#{idx + 1}</div>
                                  <img src={p.avatar} alt="" className="w-14 h-14 rounded-full ring-2 ring-white" />
                                  <div className="flex-1">
                                      <span className="font-black text-xl">{p.username}</span>
                                      <div className="text-sm text-gray-400">{votesReceived} votes</div>
                                  </div>
                                  <div className="text-right">
                                      <div className="font-black text-2xl text-green-400">+{pointsGained}</div>
                                      <div className="text-xs text-gray-500 font-bold uppercase">{p.score} total</div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  {user.isHost && (
                      <button onClick={() => socket.emit("next-meme", room.code)} className="w-full py-5 bg-white text-black font-black text-xl rounded-full mt-8 hover:scale-[1.02] transition-transform">
                          MÈME SUIVANT
                      </button>
                  )}
              </div>
          )}

          {/* Phase: Ended */}
          {room.status === 'ended' && (
              <div className="w-full text-center space-y-8 py-20">
                  <Award size={100} className="mx-auto text-yellow-400 animate-bounce" />
                  <h2 className="text-6xl font-black italic tracking-tighter uppercase">Partie Terminée</h2>

                  <div className="bg-white/10 p-8 rounded-[3rem] inline-block text-left min-w-[300px]">
                      {room.players.sort((a,b) => b.score - a.score).map((p, idx) => (
                          <div key={p.id} className="flex items-center gap-6 mb-4 last:mb-0">
                              <span className="text-3xl font-black text-gray-500">#{idx + 1}</span>
                              <img src={p.avatar} alt="" className="w-16 h-16 rounded-full" />
                              <div>
                                  <div className="font-black text-2xl">{p.username}</div>
                                  <div className="text-[#00f2fe] font-black">{p.score} pts</div>
                              </div>
                          </div>
                      ))}
                  </div>

                  <button onClick={() => window.location.href = '/'} className="block mx-auto mt-10 px-8 py-4 border-2 border-white/20 rounded-full font-black hover:bg-white/10 transition-colors">
                      RETOUR AU HUB
                  </button>
              </div>
          )}

      </main>
    </div>
  );
}
