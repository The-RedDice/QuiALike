"use client";

import { useState } from "react";

interface LoginProps {
  onLogin: (username: string, avatar: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const trimmedUsername = username.trim();
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(trimmedUsername)}`;
      const data = { username: trimmedUsername, avatar };

      // Save to cookie so a refresh keeps them logged in
      document.cookie = `quialike_profile=${JSON.stringify(data)}; max-age=3600000; path=/`;
      onLogin(data.username, data.avatar);
    } catch {
      setError("Erreur lors de la création du profil");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full relative z-10 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-center mb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#00f2fe]/20 to-[#fe2c55]/20 blur-xl rounded-full w-20 h-20 mx-auto -z-10 animate-pulse"></div>
        <div className="w-16 h-16 bg-[#18181b] rounded-full shadow-lg border border-white/10 flex items-center justify-center">
            <span className="text-3xl hover:rotate-12 hover:scale-110 transition-transform cursor-default">👋</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 w-full">
        <div className="text-center text-sm text-gray-400 font-medium tracking-wide">
          Entrez votre pseudo pour jouer
        </div>

        <div className="space-y-2">
          <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-[#00f2fe] transition-colors">
                  <span className="font-bold text-lg">@</span>
              </div>
              <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="pseudo"
              className="w-full pl-10 pr-4 py-4 rounded-2xl border border-white/10 focus:outline-none focus:ring-4 focus:ring-[#00f2fe]/20 focus:border-[#00f2fe] transition-all bg-[#18181b] font-bold text-white shadow-sm placeholder:text-gray-600"
              disabled={isLoading}
              />
          </div>
          {error && <p className="text-[#fe2c55] font-bold text-xs bg-[#fe2c55]/10 border border-[#fe2c55]/20 py-2 px-3 rounded-lg text-center animate-bounce">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          className={`relative w-full overflow-hidden group py-4 rounded-2xl font-black text-lg tracking-wide transition-all flex items-center justify-center gap-3 ${
            isLoading || !username.trim()
              ? "bg-[#18181b] text-gray-500 cursor-not-allowed border border-white/5"
              : "bg-white text-black hover:scale-[0.98] shadow-xl shadow-white/10"
          }`}
        >
          {(!isLoading && username.trim()) && <div className="absolute inset-0 bg-gradient-to-r from-[#00f2fe]/20 to-[#fe2c55]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}

          <div className="relative z-10 flex items-center gap-2">
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 fill-currentColor" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.18-1.3-.22-.11-.44-.24-.65-.36.01 3.66.01 7.33.01 11 0 .28-.01.55-.05.82-.19 2.22-1.3 4.31-3.23 5.46-2.15 1.34-5.01 1.49-7.31.38-2.61-1.18-4.22-4.06-3.93-6.89.23-2.5 2.12-4.63 4.58-5.17.43-.1.87-.14 1.31-.14v4.05c-.17.02-.33.04-.5.08-1.14.21-2.07 1.11-2.28 2.25-.26 1.4.67 2.8 2.05 3.04.28.05.57.05.85.04 1.1-.06 2.07-.94 2.13-2.04.03-3.24.02-6.49.02-9.73-.01-2.92.01-5.84-.02-8.75z"/>
                  </svg>
                  CONTINUER
                </>
              )}
          </div>
        </button>
      </form>
    </div>
  );
}
