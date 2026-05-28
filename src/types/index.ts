export interface Player {
  id: string;
  socketId: string;
  username: string;
  avatar: string;
  score: number;
  isHost: boolean;
  hasSubmittedVideos: boolean;
  offline?: boolean;
}

export interface Room {
  code: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'results' | 'leaderboard' | 'ended';
  currentVideoIndex: number;
  videos: Video[];
  settings: {
    videosPerPlayer: number;
  };
  currentVotes: Record<string, { targetPlayerId: string; isCorrect: boolean; timeTaken: number }>;
  videoStartTime?: number;
  playersLoadedVideo?: string[]; // IDs of players who have loaded the current video
  previousScores?: Record<string, number>;
}

export interface Video {
  id: string;
  url: string;
  videoId?: string;
  platform?: 'tiktok' | 'instagram' | 'youtube' | 'unknown';
  thumbnail: string;
  correctPlayerIds: string[]; // IDs of players who liked this video
}
