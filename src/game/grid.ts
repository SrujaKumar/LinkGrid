// Pure board helpers for coordinates, occupancy maps, and completion checks.
import { CellOccupant, Endpoint, Level, Point, Solution } from './types';

export function keyOf(point: Point) {
  return `${point.row}:${point.col}`;
}

export function samePoint(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

export function isInside(size: number, point: Point) {
  return point.row >= 0 && point.row < size && point.col >= 0 && point.col < size;
}

export function areAdjacent(a: Point, b: Point) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function getNeighbors(size: number, point: Point): Point[] {
  return [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter((candidate) => isInside(size, candidate));
}

export function colorIdsForLevel(level: Level) {
  return Array.from(new Set(level.endpoints.map((endpoint) => endpoint.colorId)));
}

export function getEndpointsByColor(level: Level) {
  const byColor: Record<string, [Endpoint, Endpoint]> = {};

  for (const colorId of colorIdsForLevel(level)) {
    const endpoints = level.endpoints.filter((endpoint) => endpoint.colorId === colorId);
    if (endpoints.length !== 2) {
      throw new Error(`Level ${level.id} must have exactly two endpoints for ${colorId}.`);
    }
    byColor[colorId] = [endpoints[0], endpoints[1]];
  }

  return byColor;
}

function buildEndpointMap(level: Level) {
  const endpoints = new Map<string, Endpoint>();
  for (const endpoint of level.endpoints) {
    endpoints.set(keyOf(endpoint), endpoint);
  }
  return endpoints;
}

export function buildOccupants(level: Level, paths: Record<string, Point[]>) {
  const endpointMap = buildEndpointMap(level);
  const colorById = new Map<string, string>();
  const occupants = new Map<string, CellOccupant>();

  for (const endpoint of level.endpoints) {
    if (endpoint.color) {
      colorById.set(endpoint.colorId, endpoint.color);
    }
  }

  for (const [colorId, path] of Object.entries(paths)) {
    for (const point of path) {
      const endpoint = endpointMap.get(keyOf(point));
      occupants.set(keyOf(point), {
        colorId,
        color: endpoint?.color ?? colorById.get(colorId),
        isEndpoint: Boolean(endpoint),
      });
    }
  }

  for (const endpoint of level.endpoints) {
    occupants.set(keyOf(endpoint), {
      colorId: endpoint.colorId,
      color: endpoint.color ?? colorById.get(endpoint.colorId),
      isEndpoint: true,
    });
  }

  return occupants;
}

export function isComplete(level: Level, solution: Solution | null, paths: Record<string, Point[]>) {
  if (!solution) {
    return false;
  }

  const occupants = buildOccupants(level, paths);
  const endpointsByColor = getEndpointsByColor(level);

  for (let row = 0; row < level.size; row += 1) {
    for (let col = 0; col < level.size; col += 1) {
      if (!occupants.has(keyOf({ row, col }))) {
        return false;
      }
    }
  }

  for (const colorId of colorIdsForLevel(level)) {
    const [start, end] = endpointsByColor[colorId];
    const connectedCells = collectConnectedColorCells(level, occupants, start, colorId);
    if (!connectedCells.has(keyOf(end))) {
      return false;
    }

    for (const [key, occupant] of occupants) {
      if (occupant.colorId === colorId && !connectedCells.has(key)) {
        return false;
      }
    }
  }

  return true;
}

function collectConnectedColorCells(
  level: Level,
  occupants: Map<string, CellOccupant>,
  start: Point,
  colorId: string,
) {
  const visited = new Set<string>();
  const queue = [start];

  while (queue.length > 0) {
    const point = queue.shift();
    if (!point) {
      break;
    }

    const key = keyOf(point);
    if (visited.has(key) || occupants.get(key)?.colorId !== colorId) {
      continue;
    }

    visited.add(key);

    for (const neighbor of getNeighbors(level.size, point)) {
      if (!visited.has(keyOf(neighbor)) && occupants.get(keyOf(neighbor))?.colorId === colorId) {
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

export function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
