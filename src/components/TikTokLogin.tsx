"use client";

import { useState } from "react";

interface TikTokLoginProps {
  onLogin: (username: string, avatar: string) => void;
}

export default function TikTokLogin({ onLogin }: TikTokLoginProps) {
  const [username, setUsername] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulatedLogin = () => {
    if (!username) return;
    setIsSimulating(true);

    // Simulate OAuth delay
    setTimeout(() => {
      const simulatedAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
      onLogin(username, simulatedAvatar);
      setIsSimulating(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase ml-1 text-gray-400">Ton Pseudo TikTok</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
          <input
            type="text"
            placeholder="jules_dev"
            className="w-full pl-10 pr-4 py-4 rounded-2xl bg-white border border-gray-200 focus:ring-2 focus:ring-black outline-none transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={handleSimulatedLogin}
        disabled={!username || isSimulating}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all
          ${isSimulating ? 'bg-gray-100 text-gray-400' : 'bg-[#fe2c55] text-white hover:opacity-90 active:scale-[0.98] shadow-lg shadow-[#fe2c55]/20'}
        `}
      >
        {isSimulating ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        ) : (
          <>
            <svg className="w-5 h-5 fill-currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.18-1.3-.22-.11-.44-.24-.65-.36.01 3.66.01 7.33.01 11 0 .28-.01.55-.05.82-.19 2.22-1.3 4.31-3.23 5.46-2.15 1.34-5.01 1.49-7.31.38-2.61-1.18-4.22-4.06-3.93-6.89.23-2.5 2.12-4.63 4.58-5.17.43-.1.87-.14 1.31-.14v4.05c-.17.02-.33.04-.5.08-1.14.21-2.07 1.11-2.28 2.25-.26 1.4.67 2.8 2.05 3.04.28.05.57.05.85.04 1.1-.06 2.07-.94 2.13-2.04.03-3.24.02-6.49.02-9.73-.01-2.92.01-5.84-.02-8.75z"/>
            </svg>
            Se connecter avec TikTok
          </>
        )}
      </button>
    </div>
  );
}
