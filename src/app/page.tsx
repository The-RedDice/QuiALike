"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socket";
import { Room, Player } from "@/types";
import { Users, Play } from "lucide-react";
import GameBoard from "@/components/GameBoard";
import TikTokLogin from "@/components/TikTokLogin";

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
    const match = document.cookie.match(new RegExp('(^| )tiktok_profile=([^;]+)'));
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

    socket.on("next-video", ({ currentVideoIndex }: { currentVideoIndex: number }) => {
        setRoom(prev => prev ? { ...prev, currentVideoIndex } : null);
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
      socket.off("game-ended");
      socket.off("results-revealed");
    };
  }, [socket, profile.username, room?.code]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem("current_room");
    document.cookie = "tiktok_profile=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  };

  const createRoom = () => {
    if (!isLoggedIn || !socket) return;
    socket.emit("create-room", profile);
  };

  const joinRoom = () => {
    if (!isLoggedIn || !roomCode || !socket) return;
    socket.emit("join-room", roomCode, profile);
  };

  const startGame = () => {
    if (room && socket) {
      socket.emit("start-game", room.code);
    }
  };

  if (room && (room.status === 'playing' || room.status === 'results')) {
      if (!user || !socket) return null;
      return <GameBoard room={room} user={user} socket={socket} />;
  }

  if (room) {
    const allSubmitted = room.players.every(p => p.hasSubmittedVideos);
    const iHaveSubmitted = user?.hasSubmittedVideos;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 text-gray-900">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-between items-center mb-10 relative">
            <h1 className="text-2xl font-bold tracking-tight text-gray-400 flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-widest mb-1 text-[#00f2fe] font-black">Salle</span>
              <span className="text-black font-black text-3xl">{room.code}</span>
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
                className="group flex items-center gap-4 p-4 bg-gray-50/80 rounded-3xl border border-transparent hover:border-[#00f2fe]/30 hover:bg-white hover:shadow-lg transition-all duration-300 animate-in slide-in-from-bottom-4"
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
                  <span className="font-black text-lg text-gray-900 group-hover:text-black transition-colors">
                    {p.username} {p.username === profile.username && <span className="text-gray-400 text-sm ml-1 font-medium italic">(Toi)</span>}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {p.isHost && <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Host</span>}
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
                const urls = [formData.get('url1') as string, formData.get('url2') as string].filter(Boolean);
                if (urls.length > 0 && socket) {
                  socket.emit("submit-videos", { roomCode: room.code, videoUrls: urls, username: profile.username });
                }
              }}
              className="relative space-y-4 mb-10 p-6 bg-gradient-to-br from-[#fe2c55]/5 to-white border-2 border-[#fe2c55]/20 rounded-[2rem] shadow-inner animate-in fade-in slide-in-from-bottom-8 duration-700"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#fe2c55]/10 flex items-center justify-center">
                  <span className="text-[#fe2c55] font-black">?</span>
                </div>
                <h3 className="font-black text-lg uppercase tracking-tight text-gray-900">Vos pépites</h3>
              </div>
              <p className="text-sm text-gray-500 font-medium mb-4 leading-relaxed">Collez les liens de 2 TikToks récents. <span className="text-[#fe2c55] font-bold">Plus c&apos;est gênant, plus c&apos;est drôle.</span></p>

              <div className="space-y-3">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00f2fe] transition-colors">
                    <span className="font-bold text-sm">1</span>
                  </div>
                  <input name="url1" type="url" required placeholder="Lien TikTok..." className="w-full pl-10 pr-4 py-4 rounded-2xl bg-white border border-gray-200 focus:ring-4 focus:ring-[#00f2fe]/10 focus:border-[#00f2fe] outline-none text-sm transition-all shadow-sm" />
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00f2fe] transition-colors">
                    <span className="font-bold text-sm">2</span>
                  </div>
                  <input name="url2" type="url" placeholder="Lien TikTok (Optionnel)" className="w-full pl-10 pr-4 py-4 rounded-2xl bg-white border border-gray-200 focus:ring-4 focus:ring-[#00f2fe]/10 focus:border-[#00f2fe] outline-none text-sm transition-all shadow-sm" />
                </div>
              </div>

              <button type="submit" className="relative w-full overflow-hidden mt-6 group bg-black rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00f2fe] to-[#fe2c55] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative w-full py-4 text-white font-black text-lg tracking-wide hover:scale-[0.98] transition-transform flex justify-center items-center gap-2 z-10">
                  VALIDER MES VIDÉOS
                </div>
              </button>
            </form>
          ) : (
            <div className="mb-10 p-6 bg-gradient-to-br from-green-400/10 to-green-500/5 border-2 border-green-500/20 text-green-700 rounded-[2rem] text-center font-bold text-lg animate-in zoom-in-95 duration-500 shadow-sm flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce shadow-green-500/30">
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
                  ? "bg-black text-white hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-black/20"
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
            <div className="text-center p-6 bg-gray-50 border border-gray-100 text-gray-400 font-black tracking-widest uppercase text-sm rounded-3xl flex items-center justify-center gap-3 shadow-inner">
              <div className="w-2 h-2 bg-[#00f2fe] rounded-full animate-ping"></div>
              En attente du host...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-white text-gray-900">
      <div className="w-full max-w-sm space-y-12">
        <div className="text-center">
          <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black tracking-widest uppercase mb-4">Beta v0.1</div>
          <h1 className="text-5xl font-black italic tracking-tighter mb-2 leading-none">TIKTOK<br/>GUESSER</h1>
          <p className="text-gray-400 font-medium mt-4">Devinez qui parmi vos amis a liké ces vidéos.</p>
        </div>

        {!isLoggedIn ? (
          <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100">
            <TikTokLogin onLogin={(username, avatar) => {
              setProfile({ username, avatar });
              setIsLoggedIn(true);
            }} />
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl mb-8 border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.avatar} alt={profile.username} className="w-14 h-14 rounded-full ring-4 ring-white" />
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Connecté en tant que</p>
                    <p className="text-xl font-black">@{profile.username}</p>
                </div>
                <button onClick={handleLogout} className="ml-auto text-xs font-bold text-gray-400 hover:text-black">Changer</button>
             </div>

            <div className="space-y-3">
                <button
                onClick={createRoom}
                className="w-full py-5 bg-black text-white rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10"
                >
                Créer une partie
                </button>

                <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-4 text-gray-300 font-black tracking-widest">ou rejoindre</span>
                </div>
                </div>

                <div className="space-y-3">
                <input
                    type="text"
                    placeholder="CODE"
                    className="w-full p-5 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-black outline-none transition-all text-center font-black text-2xl tracking-[0.5em] uppercase placeholder:tracking-normal placeholder:text-sm placeholder:font-bold"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                />
                <button
                    onClick={joinRoom}
                    className="w-full py-5 bg-white text-black border-2 border-black rounded-2xl font-black text-lg hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                    Rejoindre
                </button>
                </div>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-in slide-in-from-bottom-8 duration-300">
            {error}
          </div>
        )}

        <div className="flex justify-center items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
           <span className="text-[10px] uppercase font-black tracking-widest text-gray-300">
             {connected ? 'Serveur en ligne' : 'Serveur hors ligne'}
           </span>
        </div>
      </div>
    </main>
  );
}
