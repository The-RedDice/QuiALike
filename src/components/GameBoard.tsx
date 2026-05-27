"use client";

import { useState, useEffect, useRef } from "react";
import { Room, Player } from "@/types";
import { Timer, CheckCircle2, XCircle, Trophy, ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { Socket } from "socket.io-client";

interface GameBoardProps {
  room: Room;
  user: Player;
  socket: Socket;
}

export default function GameBoard({ room, user, socket }: GameBoardProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const currentVideo = room.videos[room.currentVideoIndex];

  // Initialize state based on whether we are reconnecting mid-results
  const isResultsPhase = room.status === 'results';

  const [hasVoted, setHasVoted] = useState(() => !!room.currentVotes?.[user.id]);
  const [votedPlayerId, setVotedPlayerId] = useState<string | null>(() => room.currentVotes?.[user.id]?.targetPlayerId || null);
  const [revealed, setRevealed] = useState(isResultsPhase);
  const [revealData, setRevealData] = useState<{
      results: Record<string, { targetPlayerId: string, isCorrect: boolean }>,
      correctPlayerIds: string[]
  } | null>(() => isResultsPhase ? { results: room.currentVotes, correctPlayerIds: currentVideo.correctPlayerIds } : null);
  const [votedCount, setVotedCount] = useState(() => Object.keys(room.currentVotes || {}).length);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track `revealed` in a ref so we can read it inside updateTimer without adding it to the dependency array
  const revealedRef = useRef(isResultsPhase);

  useEffect(() => {
    // Only reset state if the game transitions back to playing (next video)
    // Avoid overwriting state if we are just receiving a late reconnection in results phase
    if (room.status === 'playing') {
      setHasVoted(!!room.currentVotes?.[user.id]);
      setVotedPlayerId(room.currentVotes?.[user.id]?.targetPlayerId || null);
      setRevealed(false);
      revealedRef.current = false;
      setRevealData(null);
      setVotedCount(Object.keys(room.currentVotes || {}).length);
      setTimeLeft(30);
    } else if (room.status === 'results') {
      setHasVoted(true);
      setRevealed(true);
      revealedRef.current = true;
      setRevealData({
         results: room.currentVotes,
         correctPlayerIds: currentVideo.correctPlayerIds
      });
      setTimeLeft(0);
    }

    if (room.status === 'playing') {
        // Purely local relative timer to avoid client-server clock skew issues
        const startTimeLocal = Date.now();

        const updateTimer = () => {
          const elapsed = Math.floor((Date.now() - startTimeLocal) / 1000);
          const remaining = Math.max(0, 30 - elapsed);
          setTimeLeft(remaining);

          if (remaining === 0) {
              clearInterval(timerRef.current!);
              if (user.isHost && !revealedRef.current) {
                  socket.emit("reveal-results", room.code);
              }
          }
        };

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(updateTimer, 1000);
    }

    const handleResultsRevealed = (data: { results: Record<string, { targetPlayerId: string, isCorrect: boolean }>, correctPlayerIds: string[] }) => {
      setRevealData(data);
      setRevealed(true);
      revealedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };

    const handlePlayerVoted = () => {
        setVotedCount(prev => prev + 1);
    };

    socket.on("results-revealed", handleResultsRevealed);
    socket.on("player-voted", handlePlayerVoted);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off("results-revealed", handleResultsRevealed);
      socket.off("player-voted", handlePlayerVoted);
    };
  }, [room.currentVideoIndex, socket, user.isHost, room.code, room.videoStartTime]); // Removed 'revealed' from dependencies to prevent infinite loops

  const submitVote = (targetPlayerId: string) => {
    if (hasVoted || timeLeft === 0 || revealed) return;

    setHasVoted(true);
    setVotedPlayerId(targetPlayerId);

    // Pass local estimation of time taken, but server will verify against videoStartTime
    const timeTaken = room.videoStartTime ? Date.now() - room.videoStartTime : (30 - timeLeft) * 1000;
    socket.emit("submit-vote", { roomCode: room.code, targetPlayerId, timeTaken, username: user.username });
  };

  const nextVideo = () => {
    socket.emit("next-video", room.code);
  };



  const handleLeave = () => {
    socket.emit("leave-room", room.code);
    sessionStorage.removeItem("current_room");
    window.location.href = '/';
  };

  if (room.status === 'results') {
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#09090b] text-white animate-in fade-in duration-700 relative">
        <button
          onClick={handleLeave}
          className="absolute top-6 left-6 p-3 rounded-full bg-white/5 hover:bg-[#fe2c55]/20 text-gray-400 hover:text-[#fe2c55] transition-colors border border-white/10 group z-50 flex items-center gap-2"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm hidden sm:inline">Quitter</span>
        </button>
        <div className="w-full max-w-md text-center">
          <div className="inline-block p-4 bg-yellow-400 rounded-full mb-6 shadow-xl shadow-yellow-200">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-12">PODIUM FINAL</h1>

          <div className="space-y-4 mb-12">
            {sortedPlayers.map((p, index) => (
              <div
                key={p.id}
                className={`
                  flex items-center gap-4 p-5 rounded-[2rem] transition-all
                  ${index === 0 ? 'bg-black text-white scale-105 shadow-2xl' : 'bg-white/5 border border-white/10'}
                `}
              >
                <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-black text-lg
                    ${index === 0 ? 'bg-yellow-400 text-white' : 'bg-white/10 text-gray-400'}
                `}>
                    {index + 1}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt={p.username} className="w-12 h-12 rounded-full ring-2 ring-white/20" />
                <span className="font-bold text-xl flex-1 text-left truncate">@{p.username}</span>
                <span className={`font-black text-xl ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>{p.score}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-6 bg-gray-100 text-white rounded-3xl font-black text-lg hover:bg-gray-200 transition-all"
          >
            REJOUER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen p-4 gap-12 bg-[#09090b] text-white overflow-hidden relative">
      <button
        onClick={handleLeave}
        className="absolute top-6 left-6 p-3 rounded-full bg-white/5 hover:bg-[#fe2c55]/20 text-gray-400 hover:text-[#fe2c55] transition-colors border border-white/10 group z-50 flex items-center gap-2"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-bold text-sm hidden sm:inline">Quitter</span>
      </button>
      {/* Video Section */}
      <div className="relative w-full max-w-[320px] aspect-[9/16] bg-black rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-[10px] border-gray-900 group">
        {currentVideo.videoId ? (
            <iframe
              key={currentVideo.videoId}
              src={`https://www.tiktok.com/embed/v2/${currentVideo.videoId}`}
              className="w-full h-full border-0 pointer-events-auto"
              allow="autoplay; fullscreen"
            />
        ) : (
            <video
              key={currentVideo.url}
              src={currentVideo.url}
              className="w-full h-full object-cover"
              autoPlay
              loop
              playsInline
            />
        )}

        {/* Transparent overlay allowing clicks to pass through so the user can interact (e.g. click to play TikTok iframe) */}
        <div className="absolute inset-0 z-10 pointer-events-none"></div>

        <div className="absolute bottom-0 left-0 h-1.5 bg-white/20 w-full z-20">
            <div
                className="h-full bg-white transition-all duration-1000 ease-linear"
                style={{ width: revealed ? '0%' : `${(timeLeft / 30) * 100}%` }}
            ></div>
        </div>

        <div className="absolute top-8 left-0 right-0 px-6 flex justify-between items-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl flex items-center gap-2 text-white font-black border border-white/10 text-sm">
            <Timer size={16} className={timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'} />
            <span className={timeLeft <= 5 ? 'text-red-400' : 'text-white'}>{revealed ? 'FIN' : `${timeLeft}s`}</span>
          </div>
          <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl text-white font-black border border-white/10 text-sm">
            {room.currentVideoIndex + 1} / {room.videos.length}
          </div>
        </div>
      </div>

      {/* Game UI Section */}
      <div className="w-full max-w-md space-y-8 animate-in slide-in-from-right-8 duration-500">
        <div className="text-center lg:text-left">
          <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">C&apos;est qui<br/>le coupable ?</h2>
          <div className="flex items-center justify-center lg:justify-start gap-2 mt-4">
              <p className="text-gray-400 font-medium">{votedCount} / {room.players.length} ont voté</p>
              {hasVoted && !revealed && <Loader2 size={16} className="animate-spin text-blue-500" />}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {room.players.map((p) => {
            const isCorrect = revealData?.correctPlayerIds.includes(p.id);
            const isMyChoice = votedPlayerId === p.id;

            return (
              <button
                key={p.id}
                onClick={() => submitVote(p.id)}
                disabled={hasVoted || revealed}
                className={`
                  group relative flex items-center gap-4 p-4 rounded-[1.5rem] border-2 transition-all text-left
                  ${!hasVoted && !revealed ? 'border-white/5 bg-white/5 hover:border-white/30 hover:bg-white/10 hover:scale-[1.02]' : ''}
                  ${revealed && isCorrect ? 'border-green-500 bg-green-50 scale-[1.02]' : ''}
                  ${hasVoted && !revealed && isMyChoice ? 'border-blue-500 bg-blue-50' : ''}
                  ${hasVoted && !revealed && !isMyChoice ? 'border-white/5 bg-white/5 opacity-60' : ''}
                  ${revealed && !isCorrect && isMyChoice ? 'border-red-500 bg-red-50' : ''}
                  ${revealed && !isCorrect && !isMyChoice ? 'border-white/5 bg-white/5 opacity-30 grayscale' : ''}
                `}
              >
                <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.avatar} alt={p.username} className="w-14 h-14 rounded-full ring-4 ring-white shadow-sm" />
                    {revealed && isCorrect && (
                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 shadow-lg">
                            <CheckCircle2 size={14} />
                        </div>
                    )}
                    {revealed && !isCorrect && isMyChoice && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-lg">
                            <XCircle size={14} />
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <span className={`block font-black text-lg ${revealed && isCorrect ? 'text-green-700' : 'text-white'}`}>
                        @{p.username}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                        {p.isHost ? 'Host' : 'Joueur'}
                    </span>
                </div>
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className="p-8 rounded-[2.5rem] bg-[#18181b] text-white shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center gap-5 mb-8">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${revealData?.results[user.id]?.isCorrect ? 'bg-green-500' : 'bg-[#fe2c55]'}`}>
                {revealData?.results[user.id]?.isCorrect ? <CheckCircle2 size={30} /> : <XCircle size={30} />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Verdict</p>
                <p className="text-2xl font-black italic">{revealData?.results[user.id]?.isCorrect ? "BIEN JOUÉ !" : "T'ES NUL..."}</p>
              </div>
            </div>

            {user.isHost && (
              <button
                onClick={nextVideo}
                className="w-full py-5 bg-white text-white rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {room.currentVideoIndex < room.videos.length - 1 ? 'VIDÉO SUIVANTE' : 'VOIR LES RÉSULTATS'}
                <ArrowRight size={20} />
              </button>
            )}

            {!user.isHost && (
                <div className="text-center py-4 text-white/40 font-bold text-sm animate-pulse italic">
                    En attente du host pour la suite...
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
