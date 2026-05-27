export interface Player {
  id: string;
  username: string;
  avatar: string;
  score: number;
  isHost: boolean;
  hasSubmittedVideos: boolean;
}

export interface Room {
  code: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'results' | 'ended';
  currentVideoIndex: number;
  videos: Video[];
  settings: {
    videosPerPlayer: number;
  };
}

export interface Video {
  id: string;
  url: string;
  thumbnail: string;
  correctPlayerIds: string[]; // IDs of players who liked this video
}
