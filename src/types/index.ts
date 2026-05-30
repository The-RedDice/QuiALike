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

export type GameType = 'quialike' | 'imitmeme' | 'tiktokdubbing';

export interface BaseRoom {
  code: string;
  gameType: GameType;
  players: Player[];
}

export interface QuialikeRoom extends BaseRoom {
  gameType: 'quialike';
  status: 'lobby' | 'playing' | 'results' | 'leaderboard' | 'ended';
  currentVideoIndex: number;
  videos: Video[];
  settings: {
    videosPerPlayer: number;
  };
  currentVotes: Record<string, { targetPlayerId: string; isCorrect: boolean; timeTaken: number }>;
  videoStartTime?: number;
  playersLoadedVideo?: string[];
  previousScores?: Record<string, number>;
}

export interface ImitMemeMeme {
  id: string;
  url: string;
  platform?: 'tiktok' | 'instagram' | 'youtube' | 'unknown';
  videoId?: string;
  duration: number;
  submitterId: string;
  recordings: Record<string, string>; // playerId -> base64 audio
  fileBase64?: string; // For uploaded files
}

export interface ImitMemeRoom extends BaseRoom {
  gameType: 'imitmeme';
  status: 'lobby' | 'playing_meme' | 'recording' | 'listening' | 'voting' | 'results' | 'leaderboard' | 'ended';
  currentMemeIndex: number;
  memes: ImitMemeMeme[];
  settings: {
    memesPerPlayer: number;
  };
  currentVotes: Record<string, string>; // voterId -> targetPlayerId (voted best imitation)
  memeStartTime?: number;
  playersLoadedMeme?: string[];
  playersReadyForRecording?: string[];
  previousScores?: Record<string, number>;
  currentlyPlayingRecordingId?: string; // which player's recording is currently being played during 'listening'
}


export interface TikTokDubbingVideo {
  id: string;
  url: string;
  platform?: 'tiktok' | 'instagram' | 'youtube' | 'unknown';
  videoId?: string;
  duration: number;
  submitterId: string;
  recordings: Record<string, string>; // playerId -> base64 audio
}

export interface TikTokDubbingRoom extends BaseRoom {
  gameType: 'tiktokdubbing';
  status: 'lobby' | 'playing_video' | 'recording' | 'listening' | 'voting' | 'results' | 'leaderboard' | 'ended';
  currentVideoIndex: number;
  videos: TikTokDubbingVideo[];
  settings: {
    videosPerPlayer: number;
  };
  currentVotes: Record<string, string>; // voterId -> targetPlayerId (voted best dubbing)
  videoStartTime?: number;
  playersLoadedVideo?: string[];
  playersReadyForRecording?: string[];
  previousScores?: Record<string, number>;
  currentlyPlayingRecordingId?: string; // which player's dubbing is currently being played during 'listening'
}

export type Room = QuialikeRoom | ImitMemeRoom | TikTokDubbingRoom;


export interface Video {
  id: string;
  url: string;
  videoId?: string;
  platform?: 'tiktok' | 'instagram' | 'youtube' | 'unknown';
  thumbnail: string;
  correctPlayerIds: string[]; // IDs of players who liked this video
}
