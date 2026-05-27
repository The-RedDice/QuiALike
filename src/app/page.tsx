import Link from "next/link";
import { Gamepad2, Sparkles, Lock } from "lucide-react";

export default function HubHome() {
  const games = [
    {
      id: "tiktok-guesser",
      title: "TikTok Guesser",
      description: "Devinez qui parmi vos amis a liké ces vidéos gênantes.",
      href: "/tiktok-guesser",
      status: "active",
      tags: ["Multijoueur", "Soirée"],
      gradient: "from-[#00f2fe]/20 to-[#fe2c55]/20",
      accent: "group-hover:border-[#00f2fe]/50"
    },
    {
      id: "mystery-1",
      title: "Blind Test",
      description: "Le grand classique revisité. Préparez vos playlists.",
      href: "#",
      status: "coming_soon",
      tags: ["Musique", "Rapide"],
      gradient: "from-purple-500/10 to-blue-500/10",
      accent: ""
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
    <main className="min-h-screen bg-[#09090b] text-white p-6 selection:bg-[#00f2fe]/30 overflow-hidden relative flex flex-col items-center">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      <div className="w-full max-w-5xl mt-20 mb-16 space-y-12 relative z-10">

        {/* Header */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-black tracking-widest text-gray-400 uppercase mb-4">
            <Sparkles size={14} className="text-yellow-400" />
            <span>Party Games Hub</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
            La Soirée<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500">Commence Ici</span>
          </h1>
          <p className="text-gray-400 font-medium max-w-md mx-auto mt-6 text-lg">
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
                  ${isActive ? 'bg-[#18181b] border-white/10 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] cursor-pointer ' + game.accent : 'bg-[#0f0f12] border-white/5 opacity-70 grayscale-[30%] cursor-default'}
                `}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Card Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[2.5rem] pointer-events-none`}></div>

                <div className="relative z-10 flex-1 flex flex-col">
                  {/* Card Header (Tags & Status) */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                       <Gamepad2 size={24} className={isActive ? "text-white" : "text-gray-500"} />
                    </div>
                    {isActive ? (
                      <span className="px-3 py-1 rounded-full bg-[#00f2fe]/10 text-[#00f2fe] text-[10px] font-black uppercase tracking-wider border border-[#00f2fe]/20">
                        Jouer
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-white/5 text-gray-400 text-[10px] font-black uppercase tracking-wider border border-white/10 flex items-center gap-1">
                        <Lock size={10} /> Bientôt
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <h3 className="text-2xl font-black mb-3 group-hover:text-white transition-colors text-gray-100">{game.title}</h3>
                  <p className="text-gray-400 text-sm font-medium leading-relaxed mb-6 flex-1">
                    {game.description}
                  </p>

                  {/* Card Footer (Tags) */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {game.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold text-gray-500 bg-white/5 px-2.5 py-1 rounded-lg uppercase tracking-wider">
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
