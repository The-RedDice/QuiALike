/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Users, Play, LogOut, CheckCircle2, Crown, Search, Loader2 } from "lucide-react";
import Login from "@/components/Login";
import { playTTS } from "@/lib/tts";

export default function MemeMakerGame() {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<any>(null); // We use any here to match the dynamic server types
  const [profile, setProfile] = useState<{ username: string; avatar: string; voicePitch?: number; voiceRate?: number; } | null>(null);

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  // GIF Search State
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [gifResults, setGifResults] = useState<{id: string, url: string, preview: string}[]>([]);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);

  // Captioning State
  const [captionText, setCaptionText] = useState("");
  const [captionFont, setCaptionFont] = useState("Impact");
  const [captionColor, setCaptionColor] = useState("#ffffff");

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);

  const fonts = ["Impact", "Arial", "Comic Sans MS", "Courier New"];
  const colors = ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];

  useEffect(() => {
    const match = document.cookie.match(new RegExp('(^| )quialike_profile=([^;]+)'));
    if (match) {
      try {
        setProfile(JSON.parse(match[2]));
      } catch (e) {
        console.error("Failed to parse profile cookie", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!profile) return;

    const newSocket = io();
    setSocket(newSocket);

    const handleConnect = () => {
        const savedRoom = sessionStorage.getItem("current_room");
        if (savedRoom) {
            newSocket.emit("join-room", savedRoom, profile);
        } else if (gameState) {
            newSocket.emit("join-room", gameState.code, profile);
        }
    };

    if (newSocket.connected) {
        handleConnect();
    }

    newSocket.on("connect", handleConnect);

    newSocket.on("room-created", (room) => {
        setGameState(room);
        sessionStorage.setItem("current_room", room.code);
    });

    newSocket.on("room-updated", (room) => {
        setGameState(room);
        sessionStorage.setItem("current_room", room.code);
    });

    newSocket.on("room-update", (room) => {
        setGameState(room);
        sessionStorage.setItem("current_room", room.code);
    });

    newSocket.on("error", (msg) => {
      setError(msg);
      setIsJoining(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [profile]);

  useEffect(() => {
    // Speak logic for revealing phase
    if (gameState?.status === 'revealing' && gameState?.currentlyRevealedCaptionAuthorId) {
       const currentMeme = gameState.memes[gameState.currentMemeIndex];
       if (currentMeme) {
          const caption = currentMeme.captions[gameState.currentlyRevealedCaptionAuthorId];
          if (caption && caption.text) {
             const author = gameState.players.find((p: any) => p.id === gameState.currentlyRevealedCaptionAuthorId);
             if (author) {
                 window.speechSynthesis.cancel();
                 playTTS(caption.text, author.username, author.voicePitch, author.voiceRate);
             }
          }
       }
    }
  }, [gameState?.status, gameState?.currentlyRevealedCaptionAuthorId]);

  const createRoom = () => {
    if (!socket || !profile) return;
    setIsJoining(true);
    socket.emit("create-room", { ...profile, gameType: "mememaker" });
  };

  const joinRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket || !profile || !roomCodeInput) return;
    setIsJoining(true);
    socket.emit("join-room", roomCodeInput.toUpperCase(), profile);
  };

  const leaveRoom = () => {
    if (!socket) return;
    if (gameState) {
        socket.emit("leave-room", gameState.code);
    } else {
        socket.emit("leave-room");
    }
    sessionStorage.removeItem("current_room");
    setGameState(null);
    setIsJoining(false);
    setRoomCodeInput("");
  };

  const copyRoomCode = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.code);
  };



  const submitGif = () => {
      if (!socket || !gameState || !selectedGif) return;
      socket.emit("mememaker-submit-gif", gameState.code, selectedGif);
  };

  const startGame = () => {
      if (!socket || !gameState) return;
      socket.emit("mememaker-start-game", gameState.code);
  };

  const submitCaption = () => {
      if (!socket || !gameState || !captionText.trim()) return;
      socket.emit("mememaker-submit-caption", gameState.code, {
          text: captionText,
          font: captionFont,
          color: captionColor
      });
  };

  const nextReveal = () => {
      if (!socket || !gameState) return;
      socket.emit("mememaker-next-reveal", gameState.code);
  };

  const voteForCaption = (authorId: string) => {
      if (!socket || !gameState) return;
      socket.emit("mememaker-vote", gameState.code, authorId);
  };

  const nextRound = () => {
      if (!socket || !gameState) return;
      socket.emit("mememaker-next-round", gameState.code);
  };

  const quitGame = () => {
    leaveRoom();
    router.push("/");
  };

  if (!profile) {
    return <Login onLogin={(username, avatar, voicePitch, voiceRate) => setProfile({ username, avatar, voicePitch, voiceRate })} />;
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-transparent text-black flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 left-4">
          <button onClick={() => router.push("/")} className="text-[#404040] hover:text-black transition flex items-center gap-2 bg-[#c0c0c0] px-4 py-2 rounded-full">
            <LogOut size={16} /> Retour au Hub
          </button>
        </div>

        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md space-y-8 text-center">
          <div>
            <h1 className="text-7xl font-black mb-4 tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent goofy-bounce" style={{fontFamily: "var(--font-bangers)"}}>Meme Maker</h1>
            <p className="text-[#404040]">Le plus drôle gagne !</p>
          </div>

          <div className="game-container space-y-6 transform rotate-1">
            <div className="window-title-bar text-white">
                <span className="text-white">C:\\GAMES\\MEMEMAKER.EXE</span>
                <div className="flex gap-1">
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">_</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">□</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">x</div>
                </div>
            </div>
            <button
              onClick={createRoom}
              disabled={isJoining}
              className="game-button"
            >
              Créer une partie
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-black"></div>
              <span className="flex-shrink-0 mx-4 text-[#404040] text-sm font-medium">OU</span>
              <div className="flex-grow border-t border-black"></div>
            </div>

            <form onSubmit={joinRoom} className="space-y-3">
              <input
                type="text"
                placeholder="Code de la room"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                maxLength={6}
                className="game-input text-center text-2xl tracking-widest uppercase"
              />
              <button
                type="submit"
                disabled={!roomCodeInput || isJoining}
                className="game-button bg-[#808080] text-black border-zinc-600"
              >
                Rejoindre
              </button>
            </form>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        </motion.div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find((p: any) => p.socketId === socket?.id);
  const isHost = currentPlayer?.isHost;
  const activePlayers = gameState.players.filter((p: any) => !p.offline);
  const currentMeme = gameState.memes[gameState.currentMemeIndex];

  return (
    <div className="min-h-screen bg-transparent text-black flex flex-col p-4 md:p-8">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 bg-[#c0c0c0] p-4 goofy-border goofy-shadow transform -rotate-1">
        <div className="flex items-center gap-4">
          <button onClick={quitGame} className="p-2 hover:bg-[#808080] rounded-full transition text-[#404040] hover:text-black">
            <LogOut size={20} />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent hidden md:block">
            Meme Maker
          </h1>
        </div>
        <div className="flex items-center gap-4 bg-[#c0c0c0] px-4 py-2 rounded-xl border border-black">
          <span className="text-sm text-[#404040] font-medium">CODE:</span>
          <span className="text-xl font-black tracking-widest">{gameState.code}</span>
          <button onClick={copyRoomCode} className="text-[#404040] hover:text-black transition">
            <Copy size={16} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto">

        {/* LOBBY PHASE */}
        {gameState.status === 'lobby' && (
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
                <div className="game-container transform rotate-1">
            <div className="window-title-bar text-white">
                <span className="text-white">C:\\GAMES\\MEMEMAKER.EXE</span>
                <div className="flex gap-1">
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">_</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">□</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">x</div>
                </div>
            </div>
                    <h2 className="text-4xl font-bold mb-4 goofy-wiggle text-cyan-400" style={{fontFamily: "var(--font-bangers)", filter: "drop-shadow(2px 2px 0px #000)"}}>Trouve un GIF hilarant !</h2>
                    {currentPlayer?.hasSubmittedVideos ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                            <p className="text-xl font-bold text-green-400">GIF soumis !</p>
                            <p className="text-[#404040] mt-2">Attends les autres joueurs...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-4">
                                <input
                                    type="text"
                                    value={selectedGif || ""}
                                    onChange={(e) => setSelectedGif(e.target.value)}
                                    placeholder="Colle le lien du GIF ici (URL se terminant par .gif)"
                                    className="game-input w-full"
                                />
                                {selectedGif && (
                                    <div className="flex justify-center p-4 bg-[#c0c0c0] rounded-xl border border-black">
                                        <img
                                            src={selectedGif}
                                            className="max-h-48 object-contain rounded-lg"
                                            alt="Aperçu du GIF"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMThjODBiZjYyYzUzODQ5NjI3YjYxYzZjNjRmMjRiN2Mw/3o7aTskHEUjd211L5Z/giphy.gif';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={submitGif}
                                disabled={!selectedGif}
                                className="game-button"
                            >
                                Valider mon GIF
                            </button>
                        </div>
                    )}
                </div>

                {isHost && (
                    <button
                        onClick={startGame}
                        disabled={activePlayers.some((p: any) => !p.hasSubmittedVideos)}
                        className="game-button bg-pink-500 text-black"
                    >
                        Démarrer la partie
                    </button>
                )}
            </div>

            <div className="w-full md:w-80 space-y-4">
              <div className="game-container transform -rotate-2">
            <div className="window-title-bar text-white">
                <span className="text-white">C:\\GAMES\\MEMEMAKER.EXE</span>
                <div className="flex gap-1">
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">_</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">□</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">x</div>
                </div>
            </div>
                <div className="flex items-center gap-2 text-[#404040] mb-6">
                  <Users size={18} />
                  <span className="font-medium">{activePlayers.length} Joueurs</span>
                </div>
                <div className="space-y-4">
                  {gameState.players.map((p: any) => (
                    <div key={p.id} className={`flex items-center gap-3 ${p.offline ? 'opacity-40' : ''}`}>
                      <img src={p.avatar} alt={p.username} className="w-12 h-12 rounded-full bg-[#808080] object-cover" />
                      <div className="flex-1">
                        <div className="font-bold flex items-center gap-2">
                          {p.username}
                          {p.isHost && <Crown size={14} className="text-yellow-500" />}
                        </div>
                        <div className="text-xs text-[#404040]">
                          {p.offline ? "Déconnecté" : (p.hasSubmittedVideos ? "Prêt" : "Cherche un GIF...")}
                        </div>
                      </div>
                      {p.hasSubmittedVideos && !p.offline && <CheckCircle2 size={18} className="text-green-500" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAPTIONING PHASE */}
        {gameState.status === 'captioning' && (
            <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-5xl font-black text-center goofy-wiggle text-pink-500" style={{fontFamily: "var(--font-bangers)"}}>Ajoute ton texte !</h2>

                <div className="relative">
                    <img src={currentMeme?.gifUrl} className="w-96 rounded-xl border-4 border-black shadow-2xl" alt="Meme to caption" />
                    <div
                        className="absolute bottom-4 left-0 w-full text-center px-4 break-words"
                        style={{ fontFamily: captionFont, color: captionColor, textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                    >
                        <span className="text-3xl uppercase font-black">{captionText || "TON TEXTE ICI"}</span>
                    </div>
                </div>

                {gameState.playersSubmittedCaption?.includes(currentPlayer?.id) ? (
                     <div className="text-center">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <p className="text-xl font-bold text-green-400">Texte validé !</p>
                        <p className="text-[#404040] mt-2">En attente des autres joueurs ({gameState.playersSubmittedCaption.length}/{activePlayers.length})</p>
                    </div>
                ) : (
                    <div className="game-container w-full max-w-md space-y-4 transform -rotate-1">
            <div className="window-title-bar text-white">
                <span className="text-white">C:\\GAMES\\MEMEMAKER.EXE</span>
                <div className="flex gap-1">
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">_</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">□</div>
                    <div className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[10px] cursor-pointer">x</div>
                </div>
            </div>
                        <textarea
                            value={captionText}
                            onChange={(e)=>setCaptionText(e.target.value)}
                            placeholder="Écris un truc drôle..."
                            className="game-input resize-none uppercase"
                            rows={3}
                        />

                        <div className="flex gap-4">
                            <select
                                value={captionFont}
                                onChange={(e)=>setCaptionFont(e.target.value)}
                                className="game-input flex-1 p-2"
                            >
                                {fonts.map(f => <option key={f} value={f} style={{fontFamily: f}}>{f}</option>)}
                            </select>

                            <div className="flex gap-2 bg-[#c0c0c0] border border-black p-2 rounded-xl">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={()=>setCaptionColor(c)}
                                        className={`w-8 h-8 rounded-full ${captionColor === c ? 'ring-2 ring-white scale-110' : ''} transition-all`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={submitCaption}
                            disabled={!captionText.trim()}
                            className="w-full py-4 bg-[#c0c0c0] text-black font-bold rounded-xl text-lg hover:bg-zinc-200 transition disabled:opacity-50"
                        >
                            Valider
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* REVEALING PHASE */}
        {gameState.status === 'revealing' && (
             <div className="flex flex-col items-center justify-center space-y-8 h-full">
                <h2 className="text-6xl font-black text-purple-400 goofy-bounce goofy-rainbow" style={{fontFamily: "var(--font-bangers)"}}>Révélation !</h2>

                {gameState.currentlyRevealedCaptionAuthorId && (
                    <motion.div
                        key={gameState.currentlyRevealedCaptionAuthorId}
                        initial={{ scale: 0.8, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: -50 }}
                        className="relative"
                    >
                        <img src={currentMeme?.gifUrl} className="w-[500px] rounded-2xl border-8 border-zinc-900 shadow-2xl" alt="Meme to caption" />

                        {(() => {
                            const caption = currentMeme.captions[gameState.currentlyRevealedCaptionAuthorId];
                            if (!caption) return null;
                            return (
                                <div
                                    className="absolute bottom-6 left-0 w-full text-center px-6 break-words"
                                    style={{ fontFamily: caption.font, color: caption.color, textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000' }}
                                >
                                    <span className="text-4xl uppercase font-black leading-tight">{caption.text}</span>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}

                {isHost && (
                     <button
                        onClick={nextReveal}
                        className="game-button w-auto px-12 mt-8"
                    >
                        Suivant
                    </button>
                )}
             </div>
        )}

        {/* VOTING PHASE */}
        {gameState.status === 'voting' && (
            <div className="flex flex-col items-center space-y-8">
                <h2 className="text-3xl font-black">Vote pour le meilleur !</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
                    {Object.entries(currentMeme?.captions || {}).map(([authorId, caption]: [string, any]) => {
                         // Don't vote for yourself (optional, but good for gameplay)
                         const isMe = authorId === currentPlayer?.id;
                         const hasVoted = !!gameState.currentVotes[currentPlayer?.id];
                         const myVote = gameState.currentVotes[currentPlayer?.id] === authorId;

                         return (
                            <button
                                key={authorId}
                                onClick={() => !isMe && !hasVoted && voteForCaption(authorId)}
                                disabled={isMe || hasVoted}
                                className={`relative group text-left rounded-2xl border-4 overflow-hidden transition-all duration-300
                                    ${myVote ? 'border-purple-500 scale-[1.02]' : 'border-black hover:border-zinc-600'}
                                    ${isMe ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                                `}
                            >
                                <img src={currentMeme?.gifUrl} className="w-full opacity-80 group-hover:opacity-100 transition-opacity" alt="Meme" />
                                <div
                                    className="absolute bottom-4 left-0 w-full text-center px-4 break-words z-10"
                                    style={{ fontFamily: caption.font, color: caption.color, textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                                >
                                    <span className="text-2xl uppercase font-black">{caption.text}</span>
                                </div>
                                {isMe && <div className="absolute top-4 left-4 bg-black/80 px-3 py-1 rounded-lg text-sm font-bold border border-white/20">C'est le tien</div>}
                            </button>
                         )
                    })}
                </div>
            </div>
        )}

        {/* ROUND RESULTS PHASE */}
        {gameState.status === 'round_results' && (
            <div className="flex flex-col items-center space-y-8">
                <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 goofy-bounce" style={{fontFamily: "var(--font-bangers)"}}>Résultats de la manche</h2>

                <div className="flex flex-col gap-4 w-full max-w-md">
                    {gameState.players
                        .sort((a: any, b: any) => b.score - a.score)
                        .map((p: any, idx: number) => {
                            // Calculate votes received in this round
                            const votesReceived = Object.values(gameState.currentVotes).filter(id => id === p.id).length;
                            if (votesReceived === 0) return null; // Only show people who got points to keep it clean

                            return (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex items-center gap-4 bg-[#c0c0c0] p-4 rounded-2xl border border-black"
                            >
                                <img src={p.avatar} alt={p.username} className="w-16 h-16 rounded-full object-cover border-2 border-purple-500" />
                                <div className="flex-1">
                                    <div className="font-bold text-xl">{p.username}</div>
                                    <div className="text-purple-400 font-medium">+{votesReceived * 100} pts</div>
                                </div>
                                <div className="text-3xl font-black text-zinc-700">#{idx + 1}</div>
                            </motion.div>
                        )})}
                </div>

                {isHost && (
                     <button
                        onClick={nextRound}
                        className="game-button w-auto px-12 mt-8"
                    >
                        {gameState.currentMemeIndex < gameState.memes.length - 1 ? "Manche Suivante" : "Classement Final"}
                    </button>
                )}
            </div>
        )}

        {/* LEADERBOARD PHASE */}
        {gameState.status === 'leaderboard' && (
            <div className="flex flex-col items-center justify-center space-y-8 py-12">
            <Crown size={64} className="text-yellow-500 mb-4 animate-bounce" />
            <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 text-center goofy-bounce" style={{fontFamily: "var(--font-bangers)"}}>
              Classement Final
            </h2>
            <div className="w-full max-w-md space-y-4">
              {gameState.players
                .sort((a: any, b: any) => b.score - a.score)
                .map((p: any, index: number) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.2 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${
                      index === 0 ? "bg-yellow-500/10 border-yellow-500/50" : "bg-[#c0c0c0] border-black"
                    }`}
                  >
                    <div className={`text-2xl font-black w-8 text-center ${index === 0 ? "text-yellow-500" : "text-[#404040]"}`}>
                      #{index + 1}
                    </div>
                    <img src={p.avatar} alt={p.username} className="w-12 h-12 rounded-full bg-[#808080] object-cover" />
                    <div className="flex-1 font-bold text-lg">{p.username}</div>
                    <div className="text-xl font-black">{p.score}</div>
                  </motion.div>
                ))}
            </div>

             <button
                onClick={quitGame}
                className="game-button w-auto px-12 mt-8 bg-[#808080] text-black"
            >
                Retour au Hub
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
