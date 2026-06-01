"use client";

import { useState } from "react";
import { playTTS } from "@/lib/tts";

interface LoginProps {
  onLogin: (username: string, avatar: string, voicePitch?: number, voiceRate?: number) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Avatar Customization State
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [skinColor, setSkinColor] = useState("f8d25c");
  const [top, setTop] = useState("shortHair");
  const [accessories, setAccessories] = useState("none");
  const [clothing, setClothing] = useState("blazerAndShirt");

  // Voice Customization State
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [voiceRate, setVoiceRate] = useState(1.0);

  const skinColors = ["ffdbb4", "edb98a", "fd9841", "f8d25c", "d08b5b", "ae5d29", "614335"];
  const tops = ["noHair", "eyepatch", "hat", "hijab", "turban", "winterHat1", "winterHat2", "winterHat3", "winterHat4", "longHairBigHair", "longHairBob", "longHairBun", "longHairCurly", "longHairCurvy", "longHairDreads", "longHairFrida", "longHairFro", "longHairFroBand", "longHairNotTooLong", "longHairShavedSides", "longHairMiaWallace", "longHairStraight", "longHairStraight2", "longHairStraightStrand", "shortHairDreads01", "shortHairDreads02", "shortHairFrizzle", "shortHairShaggyMullet", "shortHairShortCurly", "shortHairShortFlat", "shortHairShortRound", "shortHairShortWaved", "shortHairSides", "shortHairTheCaesar", "shortHairTheCaesarSidePart"];
  const accessoryOptions = ["none", "kurt", "prescription01", "prescription02", "round", "sunglasses", "wayfarers"];
  const clothingOptions = ["blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck"];

  const currentAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}&skinColor=${skinColor}&top=${top}&accessories=${accessories}&clothing=${clothing}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const trimmedUsername = username.trim();
      const data = { username: trimmedUsername, avatar: currentAvatarUrl, voicePitch, voiceRate };

      // Save to cookie so a refresh keeps them logged in
      document.cookie = `quialike_profile=${JSON.stringify(data)}; max-age=3600000; path=/`;
      onLogin(data.username, data.avatar, voicePitch, voiceRate);
    } catch {
      setError("Erreur lors de la création du profil");
    } finally {
      setIsLoading(false);
    }
  };

  const testVoice = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    playTTS(`Bonjour, je m'appelle ${username || 'Joueur'}`, username || 'Joueur', voicePitch, voiceRate);
  };

  return (
    <div className="w-full relative z-10 animate-in fade-in zoom-in duration-500 max-w-lg mx-auto bg-[#c0c0c0] p-6 border-t-2 border-l-2 border-white border-r-2 border-b-2 border-black shadow-[inset_1px_1px_0px_#dfdfdf,inset_-1px_-1px_0px_#808080,4px_4px_0px_rgba(0,0,0,0.5)] text-black">
      <div className="window-title-bar mb-6 -mx-6 -mt-6"><span>CREATION_PROFIL.EXE</span></div>

      <div className="flex justify-center mb-6 relative">
        <div className="w-32 h-32 bg-white rounded-full shadow-inner border-4 border-[#808080] overflow-hidden flex items-center justify-center relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
            <button
                type="button"
                onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                className="absolute inset-0 bg-black/50 text-white font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
                Aléatoire
            </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 w-full">
        <div className="game-title text-2xl">
          Entrez votre pseudo pour jouer
        </div>

        <div className="space-y-2">
          <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-black">
                  <span className="font-bold text-lg">@</span>
              </div>
              <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="pseudo"
              className="game-input pl-10"
              disabled={isLoading}
              />
          </div>
          {error && <p className="text-[#fe2c55] font-bold text-xs bg-[#fe2c55]/10 border border-[#fe2c55]/20 py-2 px-3 rounded-lg text-center animate-bounce">{error}</p>}
        </div>

        {/* Avatar Customization */}
        <div className="space-y-3 bg-[#c0c0c0] p-4 border border-[#808080]">
            <h3 className="font-bold border-b border-[#808080] pb-1 mb-2">Options Avatar</h3>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold mb-1">Couleur de peau</label>
                    <select className="game-input text-sm p-1" value={skinColor} onChange={e => setSkinColor(e.target.value)}>
                        {skinColors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1">Cheveux/Chapeau</label>
                    <select className="game-input text-sm p-1" value={top} onChange={e => setTop(e.target.value)}>
                        {tops.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1">Accessoires</label>
                    <select className="game-input text-sm p-1" value={accessories} onChange={e => setAccessories(e.target.value)}>
                        {accessoryOptions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1">Vêtements</label>
                    <select className="game-input text-sm p-1" value={clothing} onChange={e => setClothing(e.target.value)}>
                        {clothingOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* Voice Customization */}
        <div className="space-y-4 bg-[#c0c0c0] p-4 border border-[#808080]">
            <div className="flex justify-between items-center border-b border-[#808080] pb-1 mb-2">
                <h3 className="font-bold">Modulateur Vocal</h3>
                <button type="button" onClick={testVoice} className="text-xs bg-[#808080] text-white px-2 py-1 font-bold active:bg-black active:text-white border-t border-l border-white border-b border-r border-black">Tester</button>
            </div>

            <div>
                <label className="flex justify-between text-xs font-bold mb-1">
                    <span>Hauteur (Pitch)</span>
                    <span>{voicePitch.toFixed(1)}</span>
                </label>
                <input
                    type="range" min="0.1" max="2.0" step="0.1"
                    value={voicePitch} onChange={e => setVoicePitch(parseFloat(e.target.value))}
                    className="w-full accent-black"
                />
            </div>
            <div>
                <label className="flex justify-between text-xs font-bold mb-1">
                    <span>Vitesse (Rate)</span>
                    <span>{voiceRate.toFixed(1)}</span>
                </label>
                <input
                    type="range" min="0.5" max="1.5" step="0.1"
                    value={voiceRate} onChange={e => setVoiceRate(parseFloat(e.target.value))}
                    className="w-full accent-black"
                />
            </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          className={`game-button flex items-center justify-center gap-3 ${
            isLoading || !username.trim() ? "opacity-50" : "bg-[#c0c0c0] text-black"}`}
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
