import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

export function useChatBubbles(socket: Socket) {
    const [bubbles, setBubbles] = useState<Record<string, { text: string, id: number }>>({});

    useEffect(() => {
        if (!socket) return;
        const handleBubble = ({ username, text, duration }: { username: string, text: string, duration: number }) => {
            const id = Date.now();
            setBubbles(prev => ({ ...prev, [username]: { text, id } }));
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

export function ChatInput({ socket, roomCode, username }: { socket: Socket, roomCode: string, username: string }) {
    const [text, setText] = useState("");

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        socket.emit("send-chat-bubble", { roomCode, text, username });
        setText("");
    };

    return (
        <form onSubmit={handleSend} className="fixed bottom-6 right-6 z-50">
            <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={100}
                placeholder="Un message ?"
                className="bg-black/50 backdrop-blur-xl border border-white/10 text-white placeholder-white/40 px-6 py-3 rounded-full outline-none focus:border-[#00f2fe]/50 focus:ring-4 focus:ring-[#00f2fe]/10 transition-all font-medium text-sm shadow-2xl w-[250px]"
            />
        </form>
    );
}
