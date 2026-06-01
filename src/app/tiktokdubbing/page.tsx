/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socket";
import { TikTokDubbingRoom, Player } from "@/types";
import { Users, Play, ArrowLeft, Mic } from "lucide-react";
import TikTokDubbingBoard from "@/components/TikTokDubbingBoard";
import Login from "@/components/Login";
import { ChatInput, useChatBubbles, ChatBubble } from "@/components/ChatBubble";
import { Reactions } from "@/components/Reactions";

export default function Home() {
  const { socket } = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<TikTokDubbingRoom | null>(null);
  const [user, setUser] = useState<Player | null>(null);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<{ username: string; avatar: string; voicePitch?: number; voiceRate?: number; }>({ username: "", avatar: "" });

  useEffect(() => {
    const match = document.cookie.match(new RegExp('(^| )quialike_profile=([^;]+)'));
    if (match) {
      try {
        const profileData = JSON.parse(decodeURIComponent(match[2]));
        if (profileData.username !== profile.username) {
            setProfile(profileData);
            setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Failed to parse profile cookie", e);
      }
    }
  }, [profile.username]);

  useEffect(() => {
    if (!socket || !profile.username) return;

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

    socket.on("room-created", (newRoom: any) => {
      sessionStorage.setItem("current_room", newRoom.code);
      setRoom(newRoom);
      setUser(newRoom.players[0]);
    });

    socket.on("room-updated", (updatedRoom: any) => {
      sessionStorage.setItem("current_room", updatedRoom.code);
      setRoom(updatedRoom);
      const me = updatedRoom.players.find((p: any) => p.username === profile.username);
      if (me) setUser(me);
    });

    socket.on("error", (msg: string) => {
      setError(msg);
      setTimeout(() => setError(""), 3000);
    });

    socket.on("tiktokdubbing-game-started", (startedRoom: any) => {
        setRoom(startedRoom);
    });

    socket.on("dubbing-recording-phase-started", (updatedRoom: any) => {
        setRoom(updatedRoom);
    });

    socket.on("dubbing-listening-phase-started", (updatedRoom: any) => {
        setRoom(updatedRoom);
    });

    socket.on("dubbing-voting-phase-started", (updatedRoom: any) => {
        setRoom(updatedRoom);
    });

    socket.on("play-dubbing", ({ targetPlayerId }: any) => {
        setRoom(prev => prev ? { ...prev, currentlyPlayingRecordingId: targetPlayerId } as any : null);
    });

    socket.on("game-ended", (endedRoom: any) => {
        sessionStorage.removeItem("current_room");
        setRoom(endedRoom);
    });

    socket.on("tiktokdubbing-results-revealed", (data: any) => {
        if (data && data.players) {
            setRoom(prev => prev ? { ...prev, players: data.players, status: 'results', currentVotes: data.results } as any : null);
        }
    });

    socket.on("next-dubbing-video", ({ currentVideoIndex }: any) => {
        setRoom(prev => prev ? { ...prev, currentVideoIndex, status: 'playing_video', currentVotes: {}, playersReadyForRecording: [] } as any : null);
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room-created");
      socket.off("room-updated");
      socket.off("error");
      socket.off("tiktokdubbing-game-started");
      socket.off("dubbing-recording-phase-started");
      socket.off("dubbing-listening-phase-started");
      socket.off("dubbing-voting-phase-started");
      socket.off("play-dubbing");
      socket.off("game-ended");
      socket.off("tiktokdubbing-results-revealed");
      socket.off("next-dubbing-video");
    };
  }, [socket, profile, room?.code]);

  const createRoom = () => {
    if (socket) {
      socket.emit("create-room", { ...profile, gameType: "tiktokdubbing" });
    }
  };

  const joinRoom = () => {
    if (socket && roomCode) {
      socket.emit("join-room", roomCode, profile);
    }
  };

  const startGame = () => {
    if (socket && room) {
      socket.emit("start-tiktokdubbing-game", room.code);
    }
  };

  const handleLogout = () => {
      document.cookie = 'quialike_profile=; Max-Age=0; path=/;';
      setProfile({ username: "", avatar: "" });
      setIsLoggedIn(false);
  };

  const chatBubbles = useChatBubbles(socket!);

  if (room && user) {
    if (room.status !== 'lobby') {
      return (
          <>
             <TikTokDubbingBoard room={room} user={user} socket={socket} />
             {socket && <ChatInput socket={socket} roomCode={room.code} username={profile.username} />}
             {socket && <Reactions socket={socket} roomCode={room.code} />}
          </>
      );
    }

    const allSubmitted = room.players.every((p: any) => p.hasSubmittedVideos);

    return (
      <div className="flex flex-col items-center min-h-screen p-4 bg-[#09090b] text-white">
        <div className="w-full max-w-4xl space-y-6 mt-10">
          <div className="flex justify-between items-center bg-[#18181b] p-6 rounded-3xl border border-white/10 shadow-xl">
            <div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-1 flex items-center gap-2">
                 <Mic size={16} className="text-[#fe2c55]" />
                 TikTok Dubbing
              </p>
              <h2 className="text-4xl font-black italic tracking-tighter">Code: <span className="text-[#00f2fe]">{room.code}</span></h2>
            </div>
            <div className="flex items-center gap-4">
               <div className="bg-[#09090b] px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                  <Users className="text-gray-400" size={20} />
                  <span className="font-bold text-xl">{room.players.length}</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-[#18181b] rounded-3xl border border-white/10 p-6">
                <h3 className="text-xl font-black mb-4 uppercase tracking-widest text-gray-400">Joueurs</h3>
                <div className="space-y-3">
                  {room.players.map((p) => (
                    <div key={p.id} className="relative bg-[#09090b] p-4 rounded-2xl flex items-center gap-4 border border-white/5">
                      <div className="relative">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                         <img src={p.avatar} alt={p.username} className={`w-12 h-12 rounded-full ring-2 ${p.hasSubmittedVideos ? 'ring-green-500' : 'ring-white/20'}`} />
                         {p.hasSubmittedVideos && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-[#09090b]">
                               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                         )}
                      </div>
                      <div className="flex-1">
                         <span className="font-bold text-lg">{p.username}</span>
                         {p.isHost && <span className="ml-2 text-xs bg-[#fe2c55]/20 text-[#fe2c55] px-2 py-1 rounded-full font-black uppercase tracking-wider">Host</span>}
                      </div>
                      <div className="absolute right-4">
                         {chatBubbles[p.username] && <ChatBubble text={chatBubbles[p.username].text} />}
                      </div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="bg-[#18181b] rounded-3xl border border-white/10 p-6 flex flex-col justify-center">
                 {!user.hasSubmittedVideos ? (
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const url = formData.get('url') as string;
                        if (url) {
                            socket.emit("submit-tiktokdubbing-video", {
                                roomCode: room.code,
                                url,
                                duration: "15",
                                username: user.username
                            });
                        }
                    }} className="space-y-4">
                        <div>
                           <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Lien TikTok à doubler</label>
                           <input type="text" name="url" placeholder="https://vm.tiktok.com/..." required className="w-full p-4 rounded-2xl bg-[#09090b] border border-white/10 text-white focus:border-[#00f2fe]/50 focus:ring-1 focus:ring-[#00f2fe]/50 outline-none transition-all" />
                        </div>
                        <button type="submit" className="w-full py-4 bg-white text-black font-black text-lg rounded-2xl hover:scale-[0.98] transition-transform">
                            SOUMETTRE LA VIDÉO
                        </button>
                    </form>
                 ) : (
                    <div className="text-center p-8 bg-green-500/10 border-2 border-green-500/20 rounded-2xl text-green-500 font-bold">
                        <div className="w-16 h-16 bg-green-500 text-black rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
                        Vidéo soumise !
                    </div>
                 )}

                 {user.isHost && (
                     <div className="mt-8 pt-6 border-t border-white/10">
                         <button
                           onClick={startGame}
                           disabled={!allSubmitted}
                           className={`w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all ${allSubmitted ? 'bg-gradient-to-r from-[#00f2fe] to-[#fe2c55] text-white hover:scale-[1.02]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                         >
                            <Play fill="currentColor" /> LANCER LE JEU
                         </button>
                     </div>
                 )}
             </div>
          </div>
        </div>
        {socket && <ChatInput socket={socket} roomCode={room.code} username={profile.username} />}
        {socket && <Reactions socket={socket} roomCode={room.code} />}
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#09090b] text-white overflow-hidden relative">
      <button onClick={() => window.location.href = '/'} className="absolute top-6 left-6 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 flex items-center gap-2 z-50">
        <ArrowLeft size={20} /> <span className="font-bold text-sm">Retour</span>
      </button>

      <div className="w-full max-w-sm space-y-12 relative z-10">
        <div className="text-center">
          <h1 className="text-5xl font-black italic tracking-tighter mb-2 leading-none text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00f2fe]">
            TIKTOK DUBBING
          </h1>
          <p className="text-gray-500 font-medium mt-4 text-sm max-w-[250px] mx-auto leading-relaxed">
            Doublez les TikToks de vos potes.
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="bg-[#18181b] p-8 rounded-3xl border border-white/10">
            <Login onLogin={(username, avatar, voicePitch, voiceRate) => {
              setProfile({ username, avatar, voicePitch, voiceRate });
              setIsLoggedIn(true);
            }} />
          </div>
        ) : (
          <div className="space-y-6">
             <div className="flex items-center gap-4 p-4 bg-[#18181b] rounded-2xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.avatar} alt={profile.username} className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                    <p className="text-xl font-black truncate">@{profile.username}</p>
                </div>
                <button onClick={handleLogout} className="p-2 bg-white/5 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-500">
                   X
                </button>
             </div>

            <div className="space-y-4">
                <button onClick={createRoom} className="w-full py-5 rounded-2xl font-black text-xl transition-all bg-white text-black hover:scale-[1.02]">
                    CRÉER UNE PARTIE
                </button>
                <div className="flex justify-center text-xs font-bold text-gray-500 uppercase tracking-widest">ou</div>
                <div className="space-y-3 bg-[#18181b] p-4 rounded-2xl border border-white/10">
                  <input type="text" placeholder="CODE" className="w-full p-4 rounded-xl bg-[#09090b] border border-white/10 text-white text-center font-black text-2xl tracking-[0.5em] uppercase outline-none" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
                  <button onClick={joinRoom} className="w-full py-4 bg-white/10 text-white border border-white/10 rounded-xl font-black hover:bg-white/20 transition-colors">
                      REJOINDRE
                  </button>
                </div>
            </div>
          </div>
        )}
        {error && <div className="text-center text-red-500 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</div>}
      </div>
    </main>
  );
}
