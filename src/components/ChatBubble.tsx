import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { playTTS } from "@/lib/tts";

export function useChatBubbles(socket: Socket) {
    const [bubbles, setBubbles] = useState<Record<string, { text: string, id: number }>>({});

    useEffect(() => {
        if (!socket) return;
        const handleBubble = ({ username, text, duration, voicePitch, voiceRate }: { username: string, text: string, duration: number, voicePitch?: number, voiceRate?: number }) => {
            const id = Date.now();
            setBubbles(prev => ({ ...prev, [username]: { text, id } }));

            // Read aloud if not muted
            const isMuted = localStorage.getItem('quialike_tts_muted') === 'true';
            if (!isMuted) {
                playTTS(text, username, voicePitch, voiceRate);
            }
            setTimeout(() => {
                setBubbles(prev => {
                    if (prev[username]?.id === id) {
                        const newBubbles = { ...prev };
                        delete newBubbles[username];
                        return newBubbles;
                    }
                    return prev;
                });
            }, duration);
        };
        socket.on("show-chat-bubble", handleBubble);
        return () => {
            socket.off("show-chat-bubble", handleBubble);
        };
    }, [socket]);

    return bubbles;
}

export function ChatBubble({ text }: { text: string }) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
                <div className="bg-white text-black px-4 py-2 rounded-2xl rounded-bl-none text-sm font-bold shadow-xl max-w-[200px] break-words">
                    {text}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

import { Volume2, VolumeX } from "lucide-react";

export function ChatInput({ socket, roomCode, username }: { socket: Socket, roomCode: string, username: string }) {
    const [text, setText] = useState("");
    const [isMuted, setIsMuted] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('quialike_tts_muted') === 'true';
        }
        return false;
    });

    const toggleMute = () => {
        setIsMuted(prev => {
            const newVal = !prev;
            if (typeof window !== 'undefined') {
                localStorage.setItem('quialike_tts_muted', String(newVal));
            }
            if (newVal && typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            return newVal;
        });
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        socket.emit("send-chat-bubble", { roomCode, text, username });
        setText("");
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
            <button
                type="button"
                onClick={toggleMute}
                className={`p-3 rounded-full backdrop-blur-xl border transition-all shadow-xl ${isMuted ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' : 'bg-black/50 text-white border-white/10 hover:bg-black/70'}`}
                title={isMuted ? "Activer les voix (TTS)" : "Désactiver les voix (TTS)"}
            >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <form onSubmit={handleSend} className="relative">
                <input
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    maxLength={100}
                    placeholder="Un message ?"
                    className="bg-black/50 backdrop-blur-xl border border-white/10 text-white placeholder-white/40 px-6 py-3 rounded-full outline-none focus:border-[#00f2fe]/50 focus:ring-4 focus:ring-[#00f2fe]/10 transition-all font-medium text-sm shadow-2xl w-[250px]"
                />
            </form>
        </div>
    );
}
