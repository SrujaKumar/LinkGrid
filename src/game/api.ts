// API adapter: converts mock backend data into app types and provides local fallbacks.
import { generateLevel } from './generator';
import { Difficulty, Level, LevelSummary, Score } from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4010';
const EXAMPLE_LEVEL_ID = 'sha256:0a003a02256360a43ca231b084a85b4c85014edaddc59fdf0068f084236d3d3d';
let cachedLocalLevels: Level[] | null = null;

type ApiCell = {
  x: number;
  y: number;
};

type ApiPair = {
  id: string;
  color: string;
  start: ApiCell;
  end: ApiCell;
};

type ApiLevel = {
  size: 5;
  difficulty: Difficulty;
  pairs: ApiPair[];
};

type LevelListResponse = {
  levels: LevelSummary[];
};

type GetLevelResponse = {
  meta: {
    levelId: string;
    createdAt: string;
  };
  level: ApiLevel;
};

type ScoreEntry = {
  scoreId: string;
  levelId: string;
  durationMs: number;
  moves?: number;
  playerName?: string;
  createdAt: string;
};

type ScoreboardResponse = {
  scores: ScoreEntry[];
};

type CreateScoreResponse = {
  score: ScoreEntry;
};

export async function fetchLevels(difficulty?: Difficulty): Promise<LevelSummary[]> {
  // Flow 2: if API data is missing/unreliable for medium or hard, use generated local levels.
  if (difficulty && difficulty !== 'easy') {
    return localLevelSummaries(difficulty);
  }

  const params = new URLSearchParams({ limit: '50' });
  if (difficulty) {
    params.set('difficulty', difficulty);
  }

  try {
    // Flow 1: when the mock API is available, easy levels come from Docker/Prism.
    const response = await fetch(`${API_BASE_URL}/levels?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`GET /levels failed with ${response.status}`);
    }
    const body = (await response.json()) as LevelListResponse;
    const levels = difficulty ? body.levels.filter((level) => level.difficulty === difficulty) : body.levels;
    return levels.length > 0 ? levels : localLevelSummaries(difficulty);
  } catch {
    // Flow 2: if Docker/API is down, the app still works from local fallback levels.
    return localLevelSummaries(difficulty);
  }
}

export async function fetchLevel(levelId: string): Promise<{ level: Level }> {
  try {
    const response = await fetch(`${API_BASE_URL}/levels/${encodeURIComponent(levelId)}`);
    if (!response.ok) {
      throw new Error(`GET /levels/${levelId} failed with ${response.status}`);
    }
    const body = (await response.json()) as GetLevelResponse;
    if (body.meta.levelId !== levelId) {
      throw new Error(`GET /levels/${levelId} returned ${body.meta.levelId}`);
    }
    return { level: fromApiLevel(body.level, body.meta.levelId) };
  } catch {
    // Flow 2: failed detail requests resolve to the matching local level when possible.
    return { level: localLevels().find((level) => level.id === levelId) ?? localExampleLevel() };
  }
}

export async function fetchScores(levelId: string): Promise<Score[]> {
  try {
    const params = new URLSearchParams({ levelId, order: 'asc', limit: '10' });
    const response = await fetch(`${API_BASE_URL}/scores?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`GET /scores failed with ${response.status}`);
    }
    const body = (await response.json()) as ScoreboardResponse;
    return body.scores.map(fromApiScore);
  } catch {
    return [];
  }
}

export async function submitScore(score: {
  levelId: string;
  elapsedMs: number;
  moves?: number;
  playerName: string;
}): Promise<Score> {
  try {
    const response = await fetch(`${API_BASE_URL}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        levelId: score.levelId,
        durationMs: score.elapsedMs,
        moves: score.moves,
        playerName: score.playerName,
      }),
    });

    if (!response.ok) {
      throw new Error(`POST /scores failed with ${response.status}`);
    }

    const body = (await response.json()) as CreateScoreResponse;
    return fromApiScore(body.score);
  } catch {
    return {
      id: `local-${Date.now()}`,
      levelId: score.levelId,
      playerName: score.playerName,
      elapsedMs: score.elapsedMs,
      moves: score.moves,
      createdAt: new Date().toISOString(),
      failed: true,
    };
  }
}

function fromApiLevel(level: ApiLevel, levelId: string): Level {
  return {
    id: levelId,
    size: level.size,
    difficulty: level.difficulty,
    endpoints: level.pairs.flatMap((pair) => [
      fromApiCell(pair.start, pair.id, pair.color),
      fromApiCell(pair.end, pair.id, pair.color),
    ]),
  };
}

function fromApiCell(cell: ApiCell, colorId: string, color: string) {
  return {
    row: cell.y,
    col: cell.x,
    colorId,
    color,
  };
}

function fromApiScore(score: ScoreEntry): Score {
  return {
    id: score.scoreId,
    levelId: score.levelId,
    playerName: score.playerName ?? 'Player',
    elapsedMs: score.durationMs,
    moves: score.moves,
    createdAt: score.createdAt,
  };
}

function localLevelSummaries(difficulty?: Difficulty): LevelSummary[] {
  return localLevels()
    .map((level) => ({
      levelId: level.id,
      size: level.size,
      difficulty: level.difficulty,
      pairCount: level.endpoints.length / 2,
      createdAt: level.id === EXAMPLE_LEVEL_ID ? '2026-02-25T10:30:00Z' : new Date().toISOString(),
    }))
    .filter((level) => !difficulty || level.difficulty === difficulty);
}

function localLevels() {
  if (!cachedLocalLevels) {
    cachedLocalLevels = [
      localExampleLevel(),
      generateLevel({ size: 5, difficulty: 'medium' }),
      generateLevel({ size: 5, difficulty: 'hard' }),
    ];
  }

  return cachedLocalLevels;
}

function localExampleLevel(): Level {
  return {
    id: EXAMPLE_LEVEL_ID,
    size: 5,
    difficulty: 'easy',
    endpoints: [
      { row: 0, col: 0, colorId: 'A', color: '#e74c3c' },
      { row: 0, col: 4, colorId: 'A', color: '#e74c3c' },
      { row: 1, col: 0, colorId: 'B', color: '#3498db' },
      { row: 1, col: 4, colorId: 'B', color: '#3498db' },
      { row: 2, col: 0, colorId: 'C', color: '#2ecc71' },
      { row: 4, col: 4, colorId: 'C', color: '#2ecc71' },
    ],
  };
}
