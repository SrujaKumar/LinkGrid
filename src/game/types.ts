// Shared TypeScript types for levels, board points, solutions, and scores.
export type Difficulty = 'easy' | 'medium' | 'hard';

export type Point = {
  row: number;
  col: number;
};

export type Endpoint = Point & {
  colorId: string;
  color?: string;
};

export type Level = {
  id: string;
  size: number;
  difficulty: Difficulty;
  endpoints: Endpoint[];
};

export type Solution = {
  levelId: string;
  paths: Record<string, Point[]>;
};

export type Score = {
  id: string;
  levelId: string;
  playerName: string;
  elapsedMs: number;
  moves?: number;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
};

export type CellOccupant = {
  colorId: string;
  color?: string;
  isEndpoint: boolean;
};

export type LevelSummary = {
  levelId: string;
  size: number;
  difficulty: Difficulty;
  pairCount: number;
  createdAt: string;
};
