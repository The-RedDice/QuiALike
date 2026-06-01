"use client";

import Link from "next/link";
import { Gamepad2, Sparkles, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function HubHome() {
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);

  useEffect(() => {
    // Only connect briefly on the hub to get stats
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
       path: "/socket.io/",
       transports: ["websocket"],
    });

    socket.on("global-stats", (stats: { connectedUsers: number }) => {
       setOnlineUsers(stats.connectedUsers);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const games = [
    {
      id: "mememaker",
      status: "active",
      accent: "hover:border-purple-500/50",
      title: "Meme Maker",
      description: "Ajoute le meilleur texte à un GIF. Le plus drôle gagne !",
      href: "/mememaker",
      color: "bg-purple-500",
      icon: "😂",
      tags: ["Nouveau", "GIF", "Memes"]
    },
    {
      id: "quialike",
      title: "QuiALiké",
      description: "Devinez qui parmi vos amis a liké ces vidéos gênantes.",
      href: "/quialike",
      status: "active",
      tags: ["Multijoueur", "Soirée"],
      gradient: "from-[#00f2fe]/20 to-[#fe2c55]/20",
      accent: "group-hover:border-[#00f2fe]/50"
    },
    {
      id: "imitmeme",
      title: "Imit'Mème",
      description: "Refaites les pires audios d'internet et votez pour la meilleure imitation.",
      href: "/imitmeme",
      status: "active",
      tags: ["Micro", "Délire"],
      gradient: "from-purple-500/20 to-[#00f2fe]/20",
      accent: "group-hover:border-purple-500/50"
    },
    {
      id: "tiktokdubbing",
      title: "TikTok Dubbing",
      description: "Le Grand Doublage ! Enregistrez votre voix sur les pires TikToks muets.",
      href: "/tiktokdubbing",
      status: "active",
      tags: ["Micro", "Doublage"],
      gradient: "from-[#fe2c55]/20 to-[#00f2fe]/20",
      accent: "group-hover:border-[#fe2c55]/50"
    },
    {
      id: "mystery-2",
      title: "Qui a dit ça ?",
      description: "Retrouvez les pires citations de vos amis.",
      href: "#",
      status: "coming_soon",
      tags: ["Dossiers", "Fun"],
      gradient: "from-amber-500/10 to-orange-500/10",
      accent: ""
    }
  ];

  return (
    <main className="min-h-screen bg-transparent text-black p-6 selection:bg-[#00f2fe]/30 overflow-hidden relative flex flex-col items-center">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      <div className="w-full max-w-5xl mt-20 mb-16 space-y-12 relative z-10">

        {/* Header */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex justify-center items-center gap-4 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-black tracking-widest text-white uppercase">
                <Sparkles size={14} className="text-yellow-400" />
                <span>Party Games Hub</span>
              </div>
              {onlineUsers !== null && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-black tracking-widest text-green-400 uppercase">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </div>
                      <span>{onlineUsers} en ligne</span>
                  </div>
              )}
          </div>
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none text-white drop-shadow-[2px_2px_0_rgba(255,255,255,0.3)]">
            La Soirée<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Commence Ici</span>
          </h1>
          <p className="text-gray-300 font-medium max-w-md mx-auto mt-6 text-lg">
            Des jeux multijoueurs simples et rapides pour animer vos soirées entre potes.
          </p>
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-10">
          {games.map((game, index) => {
            const isActive = game.status === "active";
            const CardWrapper = isActive ? Link : 'div';

            return (
              <CardWrapper
                href={game.href}
                key={game.id}
                className={`
                  group relative flex flex-col p-6 rounded-[2.5rem] border transition-all duration-500
                  animate-in fade-in slide-in-from-bottom-8
                  ${isActive ? 'game-container bg-[#c0c0c0] cursor-pointer hover:bg-white ' : 'game-container opacity-50 grayscale cursor-default'}
                `}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="window-title-bar mb-4"><span>{game.title.toUpperCase()}.EXE</span><div className="flex gap-1"><div className="w-3 h-3 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[8px]">_</div><div className="w-3 h-3 bg-[#c0c0c0] border border-white border-r-black border-b-black font-bold text-black flex justify-center items-center text-[8px]">x</div></div></div>{/* Card Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[2.5rem] pointer-events-none`}></div>

                <div className="relative z-10 flex-1 flex flex-col">
                  {/* Card Header (Tags & Status) */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                       <Gamepad2 size={24} className={isActive ? "text-black" : "text-[#404040]"} />
                    </div>
                    {isActive ? (
                      <span className="px-3 py-1 rounded-full bg-[#00f2fe]/10 text-[#00f2fe] text-[10px] font-black uppercase tracking-wider border border-[#00f2fe]/20">
                        Jouer
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-white/5 text-[#404040] text-[10px] font-black uppercase tracking-wider border border-white/10 flex items-center gap-1">
                        <Lock size={10} /> Bientôt
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <h3 className="text-3xl font-black tracking-wide font-sans mb-2 text-black" style={{fontFamily: "var(--font-bangers)", filter: "drop-shadow(1px 1px 0px white)"}}>{game.title}</h3>
                  <p className="text-[#404040] text-sm font-medium leading-relaxed mb-6 flex-1">
                    {game.description}
                  </p>

                  {/* Card Footer (Tags) */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {game.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold text-[#404040] bg-white/5 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </CardWrapper>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-gray-600 text-xs font-bold tracking-widest uppercase relative z-10">
        © {new Date().getFullYear()} Party Hub
      </footer>
    </main>
  );
}
