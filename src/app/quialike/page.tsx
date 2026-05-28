"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socket";
import { Room, Player } from "@/types";
import { Users, Play, ArrowLeft } from "lucide-react";
import GameBoard from "@/components/GameBoard";
import Login from "@/components/Login";

export default function Home() {
  const { socket, connected } = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [user, setUser] = useState<Player | null>(null);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState({ username: "", avatar: "" });

  useEffect(() => {
    // Check for TikTok profile cookie on mount
    const match = document.cookie.match(new RegExp('(^| )quialike_profile=([^;]+)'));
    if (match) {
      try {
        const profileData = JSON.parse(decodeURIComponent(match[2]));
        if (profileData.username !== profile.username) {
            setProfile(profileData);
            setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Failed to parse TikTok profile cookie", e);
      }
    }
  }, [profile.username]);

  useEffect(() => {
    if (!socket || !profile.username) return;

    // Attempt auto-rejoin on connect using sessionStorage for hard-refreshes
    const handleConnect = () => {
        const savedRoom = sessionStorage.getItem("current_room");
        if (savedRoom) {
            socket.emit("join-room", savedRoom, profile);
        } else if (room) {
            socket.emit("join-room", room.code, profile);
        }
    };

    if (socket.connected) {
        handleConnect();
    }

    socket.on("connect", handleConnect);

    socket.on("room-created", (newRoom: Room) => {
      sessionStorage.setItem("current_room", newRoom.code);
      setRoom(newRoom);
      setUser(newRoom.players[0]);
    });

    socket.on("room-updated", (updatedRoom: Room) => {
      sessionStorage.setItem("current_room", updatedRoom.code);
      setRoom(updatedRoom);
      // Use profile.username instead of socket.id because socket.id can change on reconnect,
      // and within this useEffect closure, socket.id might be stale.
      const me = updatedRoom.players.find(p => p.username === profile.username);
      if (me) setUser(me);
    });

    socket.on("error", (msg: string) => {
      setError(msg);
      setTimeout(() => setError(""), 3000);
    });

    socket.on("game-started", (startedRoom: Room) => {
        setRoom(startedRoom);
    });

    socket.on("next-video", ({ currentVideoIndex, videoStartTime }: { currentVideoIndex: number, videoStartTime?: number }) => {
        setRoom(prev => prev ? { ...prev, currentVideoIndex, videoStartTime, status: 'playing', currentVotes: {} } : null);
    });

    socket.on("start-voting", ({ videoStartTime }: { videoStartTime: number }) => {
        setRoom(prev => prev ? { ...prev, videoStartTime } : null);
    });

    socket.on("game-ended", (endedRoom: Room) => {
        sessionStorage.removeItem("current_room");
        setRoom(endedRoom);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("results-revealed", (data: any) => {
        if (data && data.players) {
            setRoom(prev => prev ? { ...prev, players: data.players } : null);
        }
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room-created");
      socket.off("room-updated");
      socket.off("error");
      socket.off("game-started");
      socket.off("next-video");
      socket.off("start-voting");
      socket.off("game-ended");
      socket.off("results-revealed");
    };
  }, [socket, profile.username, room?.code]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem("current_room");
    document.cookie = "quialike_profile=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  };

  const createRoom = () => {
    if (!isLoggedIn || !socket) return;
    socket.emit("create-room", profile);
  };

  const joinRoom = () => {
    if (!isLoggedIn || !roomCode || !socket) return;
    socket.emit("join-room", roomCode, profile);
  };


  const handleLeaveRoom = () => {
    if (socket && room) {
      socket.emit("leave-room", room.code);
    }
    sessionStorage.removeItem("current_room");
    setRoom(null);
    setRoomCode("");
    window.location.href = '/';
  };

  const startGame = () => {
    if (room && socket) {
      socket.emit("start-game", room.code);
    }
  };

  if (room && (room.status === 'playing' || room.status === 'results' || room.status === 'leaderboard' || room.status === 'ended')) {
      if (!user || !socket) return null;
      return <GameBoard room={room} user={user} socket={socket} />;
  }

  if (room) {
    const allSubmitted = room.players.every(p => p.hasSubmittedVideos);
    const iHaveSubmitted = user?.hasSubmittedVideos;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#09090b] text-white relative">
        <button
          onClick={handleLeaveRoom}
          className="absolute top-6 left-6 p-3 rounded-full bg-white/5 hover:bg-[#fe2c55]/20 text-gray-400 hover:text-[#fe2c55] transition-colors border border-white/10 group z-50 flex items-center gap-2"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm hidden sm:inline">Quitter la salle</span>
        </button>
        <div className="w-full max-w-md bg-[#09090b] p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/10/50 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-between items-center mb-10 relative">
            <h1 className="text-2xl font-bold tracking-tight text-gray-500 flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-widest mb-1 text-[#00f2fe] font-black">Salle</span>
              <span className="text-white font-black text-3xl">{room.code}</span>
            </h1>
            <div className="flex items-center gap-2 text-sm font-bold bg-[#00f2fe]/10 text-[#00f2fe] px-4 py-2 rounded-2xl shadow-sm border border-[#00f2fe]/20">
              <Users size={18} className="animate-pulse" />
              <span className="text-lg">{room.players.length}</span>
            </div>

            {/* Decorative blurs */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#00f2fe]/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#fe2c55]/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          <div className="space-y-4 mb-10 relative z-10">
            {room.players.map((p, idx) => (
              <div
                key={p.id}
                className="group flex items-center gap-4 p-4 bg-white/5 rounded-3xl border border-transparent hover:border-[#00f2fe]/30 hover:bg-[#09090b] hover:shadow-lg transition-all duration-300 animate-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar} alt={p.username} className="w-14 h-14 rounded-full ring-4 ring-white shadow-sm transition-transform group-hover:scale-105" />
                  {p.hasSubmittedVideos && (
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-md animate-in zoom-in">
                      <span className="text-white text-[10px]">✓</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-lg text-white group-hover:text-white transition-colors">
                    {p.username} {p.username === profile.username && <span className="text-gray-400 text-sm ml-1 font-medium italic">(Toi)</span>}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {p.isHost && <span className="text-[9px] bg-white text-[#09090b] px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Host</span>}
                    {!p.hasSubmittedVideos && <span className="text-[10px] text-[#fe2c55] font-bold animate-pulse">Prépare ses vidéos...</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!iHaveSubmitted ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const urls = [formData.get('url1') as string, formData.get('url2') as string, formData.get('url3') as string].filter(Boolean);
                if (urls.length > 0 && socket) {
                  socket.emit("submit-videos", { roomCode: room.code, videoUrls: urls, username: profile.username });
                }
              }}
              className="relative space-y-4 mb-10 p-6 bg-gradient-to-br from-[#fe2c55]/10 to-[#18181b] border-2 border-[#fe2c55]/20 rounded-[2rem] shadow-inner animate-in fade-in slide-in-from-bottom-8 duration-700"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#fe2c55]/10 flex items-center justify-center">
                  <span className="text-[#fe2c55] font-black">?</span>
                </div>
                <h3 className="font-black text-lg uppercase tracking-tight text-white">Vos pépites</h3>
              </div>
              <p className="text-sm text-gray-500 font-medium mb-4 leading-relaxed">Collez les liens de 2 TikToks récents. <span className="text-[#fe2c55] font-bold">Plus c&apos;est gênant, plus c&apos;est drôle.</span></p>

              <div className="space-y-3">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00f2fe] transition-colors">
                    <span className="font-bold text-sm">1</span>
                  </div>
                  <input name="url1" type="url" required placeholder="Lien TikTok..." className="w-full pl-10 pr-4 py-4 rounded-2xl bg-[#09090b] border border-gray-200 focus:ring-4 focus:ring-[#00f2fe]/10 focus:border-[#00f2fe] outline-none text-sm transition-all shadow-sm" />
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00f2fe] transition-colors">
                    <span className="font-bold text-sm">2</span>
                  </div>
                  <input name="url2" type="url" placeholder="Lien TikTok (Optionnel)" className="w-full pl-10 pr-4 py-4 rounded-2xl bg-[#09090b] border border-gray-200 focus:ring-4 focus:ring-[#00f2fe]/10 focus:border-[#00f2fe] outline-none text-sm transition-all shadow-sm" />
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00f2fe] transition-colors">
                    <span className="font-bold text-sm">3</span>
                  </div>
                  <input name="url3" type="url" placeholder="Lien TikTok (Optionnel)" className="w-full pl-10 pr-4 py-4 rounded-2xl bg-[#09090b] border border-gray-200 focus:ring-4 focus:ring-[#00f2fe]/10 focus:border-[#00f2fe] outline-none text-sm transition-all shadow-sm" />
                </div>
              </div>

              <button type="submit" className="relative w-full overflow-hidden mt-6 group bg-white rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00f2fe] to-[#fe2c55] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative w-full py-4 text-[#09090b] font-black text-lg tracking-wide hover:scale-[0.98] transition-transform flex justify-center items-center gap-2 z-10">
                  VALIDER MES VIDÉOS
                </div>
              </button>
            </form>
          ) : (
            <div className="mb-10 p-6 bg-gradient-to-br from-green-400/10 to-green-500/5 border-2 border-green-500/20 text-green-700 rounded-[2rem] text-center font-bold text-lg animate-in zoom-in-95 duration-500 shadow-sm flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-[#09090b] shadow-lg animate-bounce shadow-green-500/30">
                <span className="text-xl">✓</span>
              </div>
              Vidéos chargées !
            </div>
          )}

          {error && (
            <div className="mb-4 text-center text-red-500 font-bold text-sm animate-bounce">
              {error}
            </div>
          )}

          {user?.isHost ? (
            <button
              onClick={startGame}
              disabled={!allSubmitted}
              className={`relative w-full overflow-hidden group py-5 rounded-3xl font-black text-xl tracking-wide transition-all flex items-center justify-center gap-3 ${
                allSubmitted
                  ? "bg-white text-[#09090b] hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-black/20"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              }`}
            >
              {allSubmitted && <div className="absolute inset-0 bg-gradient-to-r from-[#00f2fe]/20 to-[#fe2c55]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}
              <div className="relative z-10 flex items-center gap-3">
                <Play size={24} fill="currentColor" className={allSubmitted ? "animate-pulse" : ""} />
                LANCER LA PARTIE
              </div>
            </button>
          ) : (
            <div className="text-center p-6 bg-[#09090b] border border-white/10 text-gray-400 font-black tracking-widest uppercase text-sm rounded-3xl flex items-center justify-center gap-3 shadow-inner">
              <div className="w-2 h-2 bg-[#00f2fe] rounded-full animate-ping"></div>
              En attente du host...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#09090b] text-white overflow-hidden relative">
      <button
        onClick={() => window.location.href = '/'}
        className="absolute top-6 left-6 p-3 rounded-full bg-white/5 hover:bg-[#00f2fe]/20 text-gray-400 hover:text-[#00f2fe] transition-colors border border-white/10 group z-50 flex items-center gap-2"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-bold text-sm hidden sm:inline">Retour au Hub</span>
      </button>
      {/* Decorative background blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#00f2fe]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#fe2c55]/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-sm space-y-12 relative z-10">
        <div className="text-center relative">
          <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#00f2fe]/10 to-[#fe2c55]/10 border border-[#00f2fe]/20 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 text-gray-600 shadow-sm">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00f2fe] to-[#fe2c55]">Beta v0.1</span>
          </div>
          <h1 className="text-6xl font-black italic tracking-tighter mb-2 leading-none relative inline-block">
            <span className="absolute -inset-2 bg-gradient-to-r from-[#00f2fe]/20 to-[#fe2c55]/20 blur-2xl -z-10 rounded-full"></span>
            <span className="text-white">QUI A</span><br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00f2fe] to-[#fe2c55]">LIKÉ ?</span>
          </h1>
          <p className="text-gray-500 font-medium mt-4 text-sm max-w-[250px] mx-auto leading-relaxed">
            Devinez qui parmi vos amis a liké ces vidéos.
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="bg-[#09090b]/60 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <Login onLogin={(username, avatar) => {
              setProfile({ username, avatar });
              setIsLoggedIn(true);
            }} />
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center gap-4 p-5 bg-[#09090b]/80 backdrop-blur-md rounded-[2rem] mb-8 border border-white/10 shadow-sm hover:shadow-md transition-shadow group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.avatar} alt={profile.username} className="w-16 h-16 rounded-full ring-4 ring-[#00f2fe]/20 group-hover:ring-[#00f2fe]/40 transition-all" />
                <div className="flex-1">
                    <p className="text-[10px] font-black tracking-widest text-[#00f2fe] uppercase mb-0.5">Connecté</p>
                    <p className="text-xl font-black text-white truncate">@{profile.username}</p>
                </div>
                <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#fe2c55]/20 flex items-center justify-center text-gray-400 hover:text-[#fe2c55] transition-colors" title="Se déconnecter">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
             </div>

            <div className="space-y-4">
                <button
                onClick={createRoom}
                className="relative w-full overflow-hidden group py-5 rounded-[2rem] font-black text-xl tracking-wide transition-all shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-[#00f2fe]/20 bg-white text-[#09090b] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00f2fe]/20 to-[#fe2c55]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    CRÉER UNE PARTIE
                  </div>
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-[#09090b]/80 backdrop-blur-sm px-4 text-gray-400 font-black tracking-widest">ou rejoindre</span>
                  </div>
                </div>

                <div className="space-y-3 bg-[#09090b]/60 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-sm">
                  <input
                      type="text"
                      placeholder="CODE"
                      className="w-full p-4 rounded-[1.5rem] bg-[#18181b] border-2 border-white/10 text-white focus:bg-[#18181b] focus:border-[#00f2fe]/30 focus:bg-[#09090b] outline-none transition-all text-center font-black text-2xl tracking-[0.5em] uppercase placeholder:tracking-normal placeholder:text-sm placeholder:font-bold placeholder:text-gray-400"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                  />
                  <button
                      onClick={joinRoom}
                      className="w-full py-4 bg-white text-[#09090b] border-2 border-white/10 rounded-[1.5rem] font-black text-lg hover:scale-[0.98] active:scale-[0.98] transition-all"
                  >
                      REJOINDRE
                  </button>
                </div>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#fe2c55] text-white px-6 py-3 rounded-full font-bold shadow-xl shadow-[#fe2c55]/20 animate-in slide-in-from-bottom-8 duration-300 z-50">
            {error}
          </div>
        )}

        <div className="flex justify-center items-center gap-2 pt-4">
           <div className="relative flex items-center justify-center">
             <div className={`absolute w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-ping opacity-75`}></div>
             <div className={`w-2 h-2 rounded-full relative z-10 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
           </div>
           <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
             {connected ? 'Serveur en ligne' : 'Serveur hors ligne'}
           </span>
        </div>
      </div>
    </main>
  );
}
