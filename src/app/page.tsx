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
    // Check for TikTok profile cookie
    const checkTikTokCookie = () => {
      const match = document.cookie.match(new RegExp('(^| )tiktok_profile=([^;]+)'));
      if (match) {
        try {
          const profileData = JSON.parse(decodeURIComponent(match[2]));
          setProfile(profileData);
          setIsLoggedIn(true);
          // Optional: Clear the cookie after reading if you want to rely on state,
          // but keeping it allows for persistent login across refreshes.
        } catch (e) {
          console.error("Failed to parse TikTok profile cookie", e);
        }
      }
    };

    checkTikTokCookie();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("room-created", (newRoom: Room) => {
      setRoom(newRoom);
      setUser(newRoom.players[0]);
    });

    socket.on("room-updated", (updatedRoom: Room) => {
      setRoom(updatedRoom);
      const me = updatedRoom.players.find(p => p.id === socket.id);
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
        setRoom(endedRoom);
    });

    socket.on("results-revealed", ({ players }: { players: Player[] }) => {
        setRoom(prev => prev ? { ...prev, players } : null);
    });

    return () => {
      socket.off("room-created");
      socket.off("room-updated");
      socket.off("error");
      socket.off("game-started");
      socket.off("next-video");
      socket.off("game-ended");
      socket.off("results-revealed");
    };
  }, [socket]);

  const handleLogout = () => {
    setIsLoggedIn(false);
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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 text-gray-900">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-400">Salle: <span className="text-black font-black">{room.code}</span></h1>
            <div className="flex items-center gap-2 text-sm font-bold bg-gray-100 px-3 py-1 rounded-full">
              <Users size={14} />
              <span>{room.players.length}</span>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {room.players.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-200 transition-all">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt={p.username} className="w-12 h-12 rounded-full ring-2 ring-white" />
                <span className="font-bold text-lg">{p.username} {p.id === socket.id && "(Toi)"}</span>
                {p.isHost && <span className="ml-auto text-[10px] bg-black text-white px-2 py-1 rounded-lg font-black uppercase">Host</span>}
              </div>
            ))}
          </div>

          {user?.isHost ? (
            <button
              onClick={startGame}
              className="w-full py-5 bg-black text-white rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3"
            >
              <Play size={20} fill="currentColor" />
              LANCER LA PARTIE
            </button>
          ) : (
            <div className="text-center p-5 bg-gray-100 text-gray-500 font-bold rounded-2xl animate-pulse">
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
            <TikTokLogin />
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
