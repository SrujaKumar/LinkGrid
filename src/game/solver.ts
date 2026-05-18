// Backtracking solver used to validate levels and provide the next hint move.
import { colorIdsForLevel, getEndpointsByColor, getNeighbors, keyOf, samePoint } from './grid';
import { Level, Point, Solution } from './types';

type SearchState = {
  occupied: Set<string>;
  paths: Record<string, Point[]>;
};

const MAX_SEARCH_STEPS = 150000;

export function solveLevel(level: Level): Solution | null {
  const endpointsByColor = getEndpointsByColor(level);
  const colorIds = colorIdsForLevel(level).sort((a, b) => {
    const [aStart, aEnd] = endpointsByColor[a];
    const [bStart, bEnd] = endpointsByColor[b];
    const aDistance = Math.abs(aStart.row - aEnd.row) + Math.abs(aStart.col - aEnd.col);
    const bDistance = Math.abs(bStart.row - bEnd.row) + Math.abs(bStart.col - bEnd.col);
    return aDistance - bDistance;
  });
  const endpointOwner = new Map<string, string>();
  let steps = 0;

  for (const endpoint of level.endpoints) {
    endpointOwner.set(keyOf(endpoint), endpoint.colorId);
  }

  const search = (colorIndex: number, state: SearchState): Record<string, Point[]> | null => {
    steps += 1;
    if (steps > MAX_SEARCH_STEPS) {
      return null;
    }

    if (colorIndex === colorIds.length) {
      return state.occupied.size === level.size * level.size ? state.paths : null;
    }

    const colorId = colorIds[colorIndex];
    const [start, end] = endpointsByColor[colorId];
    const initialPath = [start];
    state.occupied.add(keyOf(start));
    const found = extendColor(colorIndex, colorId, end, initialPath, state);
    state.occupied.delete(keyOf(start));
    return found;
  };

  const extendColor = (
    colorIndex: number,
    colorId: string,
    target: Point,
    path: Point[],
    state: SearchState,
  ): Record<string, Point[]> | null => {
    steps += 1;
    if (steps > MAX_SEARCH_STEPS) {
      return null;
    }

    const head = path[path.length - 1];
    if (samePoint(head, target)) {
      const nextPaths = { ...state.paths, [colorId]: [...path] };
      return search(colorIndex + 1, {
        occupied: state.occupied,
        paths: nextPaths,
      });
    }

    const candidates = getNeighbors(level.size, head)
      .filter((candidate) => {
        const key = keyOf(candidate);
        if (samePoint(candidate, target)) {
          return true;
        }
        if (state.occupied.has(key)) {
          return false;
        }
        const owner = endpointOwner.get(key);
        return !owner || owner === colorId;
      })
      .sort((a, b) => distance(a, target) - distance(b, target));

    for (const candidate of candidates) {
      const key = keyOf(candidate);
      if (state.occupied.has(key) && !samePoint(candidate, target)) {
        continue;
      }

      const wasOccupied = state.occupied.has(key);
      state.occupied.add(key);
      path.push(candidate);

      if (leavesNoIsolatedOpenCells(level, state.occupied, endpointOwner, colorId, candidate)) {
        const found = extendColor(colorIndex, colorId, target, path, state);
        if (found) {
          return found;
        }
      }

      path.pop();
      if (!wasOccupied) {
        state.occupied.delete(key);
      }
    }

    return null;
  };

  const paths = search(0, { occupied: new Set<string>(), paths: {} });
  return paths ? { levelId: level.id, paths } : null;
}

export function findNextMove(
  level: Level,
  currentPaths: Record<string, Point[]>,
  solution: Solution,
): { colorId: string; from: Point; to: Point } | null {
  const colorIds = colorIdsForLevel(level);

  for (const colorId of colorIds) {
    const solvedPath = solution.paths[colorId];
    const currentPath = currentPaths[colorId];
    if (!solvedPath || !currentPath || currentPath.length === 0) {
      continue;
    }

    const forwardMatch = pathPrefixMatches(currentPath, solvedPath);
    const reversed = [...solvedPath].reverse();
    const reverseMatch = pathPrefixMatches(currentPath, reversed);
    const aligned = forwardMatch ? solvedPath : reverseMatch ? reversed : null;

    if (aligned && currentPath.length < aligned.length) {
      return {
        colorId,
        from: currentPath[currentPath.length - 1],
        to: aligned[currentPath.length],
      };
    }
  }

  for (const colorId of colorIds) {
    const solvedPath = solution.paths[colorId];
    if (!solvedPath) {
      continue;
    }
    return {
      colorId,
      from: solvedPath[0],
      to: solvedPath[1],
    };
  }

  return null;
}

function pathPrefixMatches(path: Point[], solutionPath: Point[]) {
  return path.every((point, index) => samePoint(point, solutionPath[index]));
}

function distance(a: Point, b: Point) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function leavesNoIsolatedOpenCells(
  level: Level,
  occupied: Set<string>,
  endpointOwner: Map<string, string>,
  activeColorId: string,
  activeHead: Point,
) {
  for (let row = 0; row < level.size; row += 1) {
    for (let col = 0; col < level.size; col += 1) {
      const point = { row, col };
      const key = keyOf(point);
      if (occupied.has(key) || samePoint(point, activeHead)) {
        continue;
      }

      const owner = endpointOwner.get(key);
      if (owner && owner !== activeColorId) {
        continue;
      }

      const hasOpenNeighbor = getNeighbors(level.size, point).some((neighbor) => {
        const neighborKey = keyOf(neighbor);
        return !occupied.has(neighborKey) || samePoint(neighbor, activeHead);
      });

      if (!hasOpenNeighbor) {
        return false;
      }
    }
  }

  return true;
}
