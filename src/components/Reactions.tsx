"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Socket } from "socket.io-client";

const EMOJIS = ["😂", "🤯", "🔥", "❤️", "💀", "👀"];

interface Reaction {
  id: number;
  emoji: string;
  xOffset: number; // Random horizontal offset
}

interface ReactionsProps {
  socket: Socket;
  roomCode: string;
}

export function Reactions({ socket, roomCode }: ReactionsProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<Reaction[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleShowReaction = ({ emoji }: { emoji: string }) => {
      const id = Date.now() + Math.random();
      const xOffset = Math.random() * 60 - 30; // Random offset between -30px and 30px

      setFloatingEmojis((prev) => [...prev, { id, emoji, xOffset }]);

      // Remove emoji after animation completes (e.g., 2.5s)
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    };

    socket.on("show-reaction", handleShowReaction);

    return () => {
      socket.off("show-reaction", handleShowReaction);
    };
  }, [socket]);

  const sendReaction = (emoji: string) => {
    socket.emit("send-reaction", { roomCode, emoji });
  };

  return (
    <>
      {/* Floating Emojis Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
        <AnimatePresence>
          {floatingEmojis.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, y: "100vh", x: `calc(50vw + ${reaction.xOffset}px)`, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: "-10vh", scale: [0.5, 1.5, 2, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute bottom-0 text-5xl md:text-7xl"
              style={{ left: 0 }} // Positioning is handled by x in framer-motion
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dock of buttons */}
      <div className="fixed left-6 bottom-6 flex flex-col gap-3 z-50">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-12 h-12 bg-[#09090b]/80 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-2xl shadow-xl hover:scale-110 hover:bg-white/10 transition-all active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
