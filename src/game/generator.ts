// Local level generator used when the mock API does not provide a requested difficulty.
import { getNeighbors, keyOf } from './grid';
import { solveLevel } from './solver';
import { Difficulty, Level, Point } from './types';

const COLORS = [
  { id: 'A', color: '#e74c3c' },
  { id: 'B', color: '#3498db' },
  { id: 'C', color: '#2ecc71' },
  { id: 'D', color: '#f1c40f' },
  { id: 'E', color: '#8e44ad' },
  { id: 'F', color: '#009ca6' },
];

const PAIRS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

export function generateLevel({
  size,
  difficulty,
}: {
  size: number;
  difficulty: Difficulty;
}): Level {
  const pairCount = PAIRS_BY_DIFFICULTY[difficulty];

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const fullPath = generateHamiltonianPath(size);
    if (!fullPath) {
      continue;
    }

    const segments = splitPath(fullPath, difficulty);
    const colors = shuffle(COLORS).slice(0, pairCount);
    const endpoints = segments.flatMap((segment, index) => {
      const { id: colorId, color } = colors[index];
      return [
        { ...segment[0], colorId, color },
        { ...segment[segment.length - 1], colorId, color },
      ];
    });

    const level: Level = {
      id: `${difficulty}-${Date.now()}-${attempt}`,
      size,
      difficulty,
      endpoints: shuffle(endpoints),
    };

    if (solveLevel(level)) {
      return level;
    }
  }

  return fallbackLevel(difficulty);
}

function generateHamiltonianPath(size: number): Point[] | null {
  const starts = shuffle(allPoints(size));

  for (const start of starts) {
    const visited = new Set<string>([keyOf(start)]);
    const path = [start];
    if (walk(size, path, visited)) {
      return path;
    }
  }

  return null;
}

function walk(size: number, path: Point[], visited: Set<string>): boolean {
  if (path.length === size * size) {
    return true;
  }

  const head = path[path.length - 1];
  const candidates = shuffle(getNeighbors(size, head).filter((point) => !visited.has(keyOf(point))))
    .map((point) => ({
      point,
      onwardCount: getNeighbors(size, point).filter((neighbor) => !visited.has(keyOf(neighbor))).length,
    }))
    .sort((a, b) => a.onwardCount - b.onwardCount);

  for (const { point } of candidates) {
    visited.add(keyOf(point));
    path.push(point);

    if (walk(size, path, visited)) {
      return true;
    }

    path.pop();
    visited.delete(keyOf(point));
  }

  return false;
}

function splitPath(path: Point[], difficulty: Difficulty) {
  const lengthsByDifficulty: Record<Difficulty, number[]> = {
    easy: [9, 8, 8],
    medium: [7, 6, 6, 6],
    hard: [5, 5, 5, 5, 5],
  };
  const lengths = shuffle(lengthsByDifficulty[difficulty]);
  const segments: Point[][] = [];
  let cursor = 0;

  for (const length of lengths) {
    segments.push(path.slice(cursor, cursor + length));
    cursor += length;
  }

  return segments;
}

function allPoints(size: number) {
  const points: Point[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      points.push({ row, col });
    }
  }
  return points;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function fallbackLevel(difficulty: Difficulty): Level {
  const endpoints = [
    { row: 0, col: 0, colorId: 'A', color: '#e74c3c' },
    { row: 1, col: 4, colorId: 'A', color: '#e74c3c' },
    { row: 0, col: 1, colorId: 'B', color: '#3498db' },
    { row: 3, col: 1, colorId: 'B', color: '#3498db' },
    { row: 0, col: 4, colorId: 'C', color: '#2ecc71' },
    { row: 4, col: 4, colorId: 'C', color: '#2ecc71' },
    { row: 2, col: 0, colorId: 'D', color: '#f1c40f' },
    { row: 4, col: 2, colorId: 'D', color: '#f1c40f' },
    { row: 3, col: 0, colorId: 'E', color: '#8e44ad' },
    { row: 4, col: 3, colorId: 'E', color: '#8e44ad' },
  ];

  return {
    id: `fallback-${difficulty}`,
    size: 5,
    difficulty,
    endpoints: endpoints.slice(0, PAIRS_BY_DIFFICULTY[difficulty] * 2),
  };
}
