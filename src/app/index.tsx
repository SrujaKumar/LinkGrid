// Main Numberlink screen: loads levels, handles drawing, timer, hints, and scores.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchLevel, fetchLevels, fetchScores, submitScore } from '@/game/api';
import {
  areAdjacent,
  buildOccupants,
  formatElapsed,
  getEndpointsByColor,
  isComplete,
  keyOf,
  samePoint,
} from '@/game/grid';
import { findNextMove, solveLevel } from '@/game/solver';
import { Difficulty, Level, Point, Score } from '@/game/types';

const PLAYER_NAME = 'Srujan';
const BOARD_BORDER_WIDTH = 2;

export default function HomeScreen() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [level, setLevel] = useState<Level | null>(null);
  const [paths, setPaths] = useState<Record<string, Point[]>>({});
  const [message, setMessage] = useState('Connect every pair and fill the grid.');
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [scores, setScores] = useState<Score[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { width } = useWindowDimensions();
  const boardInnerSize = Math.floor(Math.min(width - 32, 390) - BOARD_BORDER_WIDTH * 2);
  const cellSize = Math.floor(boardInnerSize / (level?.size ?? 5));
  const boardSize = cellSize * (level?.size ?? 5) + BOARD_BORDER_WIDTH * 2;
  const endpointsByColor = useMemo(() => (level ? getEndpointsByColor(level) : {}), [level]);
  const solution = useMemo(() => (level ? solveLevel(level) : null), [level]);
  const occupants = useMemo(() => (level ? buildOccupants(level, paths) : new Map()), [level, paths]);
  const won = useMemo(() => Boolean(level && isComplete(level, solution, paths)), [level, paths, solution]);
  const currentPathsRef = useRef(paths);
  const activeColorRef = useRef<string | null>(null);
  const mouseIsDownRef = useRef(false);
  const boardOffsetRef = useRef({ x: 0, y: 0 });
  currentPathsRef.current = paths;

  const loadLevel = useCallback(async (nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setPaths({});
    activeColorRef.current = null;
    setStartedAt(Date.now());
    setElapsedMs(0);
    setHasSubmitted(false);
    setMessage('Loading puzzle.');

    const levels = await fetchLevels(nextDifficulty);
    const selected = levels.find((item) => item.difficulty === nextDifficulty) ?? levels[0];
    if (!selected) {
      setMessage('No level available.');
      return;
    }

    const loaded = await fetchLevel(selected.levelId);
    setLevel(loaded.level);
    setMessage('Connect all pairs.');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 500);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    void loadLevel('easy');
  }, [loadLevel]);

  useEffect(() => {
    if (!level) {
      return;
    }
    fetchScores(level.id)
      .then((loadedScores) => setScores(normalizeScores(loadedScores)))
      .catch(() => setScores([]));
  }, [level]);

  useEffect(() => {
    if (!level || !won || hasSubmitted) {
      return;
    }

    setHasSubmitted(true);
    setMessage('You Win');
    Alert.alert('You Win', `Finished in ${formatElapsed(elapsedMs)}.`);
    const optimisticScore: Score = {
      id: `pending-${Date.now()}`,
      levelId: level.id,
      playerName: PLAYER_NAME,
      elapsedMs,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setScores((current) => mergeScores(current, optimisticScore));

    submitScore({
      levelId: level.id,
      playerName: PLAYER_NAME,
      elapsedMs,
    })
      .then((saved) => {
        setScores((current) => mergeScores(current.filter((score) => score.id !== optimisticScore.id), saved));
      })
      .catch(() => {
        setScores((current) =>
          current.map((score) =>
            score.id === optimisticScore.id ? { ...score, pending: false, failed: true } : score,
          ),
        );
        setMessage('You Win. Score saved locally; API submit failed.');
      });
  }, [elapsedMs, hasSubmitted, level, won]);

  const resetBoard = () => {
    setPaths({});
    activeColorRef.current = null;
    setStartedAt(Date.now());
    setElapsedMs(0);
    setHasSubmitted(false);
    setMessage('Board reset.');
  };

  const pointFromGesture = useCallback(
    (x: number, y: number): Point | null => {
      const row = Math.floor((y - BOARD_BORDER_WIDTH) / cellSize);
      const col = Math.floor((x - BOARD_BORDER_WIDTH) / cellSize);
      if (!level || row < 0 || col < 0 || row >= level.size || col >= level.size) {
        return null;
      }
      return { row, col };
    },
    [cellSize, level],
  );

  const pointFromPage = useCallback(
    (pageX: number, pageY: number) => pointFromGesture(pageX - boardOffsetRef.current.x, pageY - boardOffsetRef.current.y),
    [pointFromGesture],
  );

  const beginDrag = useCallback(
    (point: Point) => {
      if (!level) {
        return;
      }

      const endpoint = level.endpoints.find((candidate) => samePoint(candidate, point));
      const existing = Object.entries(currentPathsRef.current).find(([, path]) =>
        path.some((candidate) => samePoint(candidate, point)),
      );

      if (endpoint) {
        activeColorRef.current = endpoint.colorId;
        setPaths((current) => ({ ...current, [endpoint.colorId]: [point] }));
        return;
      }

      if (existing) {
        const [colorId, path] = existing;
        const index = path.findIndex((candidate) => samePoint(candidate, point));
        activeColorRef.current = colorId;
        setPaths((current) => ({ ...current, [colorId]: path.slice(0, index + 1) }));
      }
    },
    [level],
  );

  const extendDrag = useCallback(
    (point: Point) => {
      const colorId = activeColorRef.current;
      if (!colorId || !level || won) {
        return;
      }

      setPaths((current) => {
        const path = current[colorId] ?? [];
        const head = path[path.length - 1];
        if (!head || samePoint(head, point)) {
          return current;
        }

        let nextPath = path;
        let nextState = current;

        for (const nextPoint of pointsBetween(head, point)) {
          const lastPoint = nextPath[nextPath.length - 1];
          if (!areAdjacent(lastPoint, nextPoint)) {
            break;
          }

          const existingIndex = nextPath.findIndex((candidate) => samePoint(candidate, nextPoint));
          if (existingIndex >= 0) {
            nextPath = nextPath.slice(0, existingIndex + 1);
            nextState = { ...nextState, [colorId]: nextPath };
            continue;
          }

          const occupant = buildOccupants(level, nextState).get(keyOf(nextPoint));
          if (occupant && occupant.colorId !== colorId) {
            break;
          }

          const endpoint = level.endpoints.find((candidate) => samePoint(candidate, nextPoint));
          if (endpoint && endpoint.colorId !== colorId) {
            break;
          }

          const [firstEndpoint, secondEndpoint] = endpointsByColor[colorId];
          const startsAtFirst = samePoint(nextPath[0], firstEndpoint);
          const targetEndpoint = startsAtFirst ? secondEndpoint : firstEndpoint;
          if (endpoint && !samePoint(endpoint, targetEndpoint)) {
            break;
          }

          nextPath = [...nextPath, nextPoint];
          nextState = { ...nextState, [colorId]: nextPath };
        }

        return nextState;
      });
    },
    [endpointsByColor, level, won],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = pointFromPage(event.nativeEvent.pageX, event.nativeEvent.pageY);
          if (point) {
            beginDrag(point);
          }
        },
        onPanResponderMove: (event) => {
          const point = pointFromPage(event.nativeEvent.pageX, event.nativeEvent.pageY);
          if (point) {
            extendDrag(point);
          }
        },
        onPanResponderRelease: (event) => {
          const point = pointFromPage(event.nativeEvent.pageX, event.nativeEvent.pageY);
          if (point) {
            extendDrag(point);
          }
          activeColorRef.current = null;
        },
        onPanResponderTerminate: () => {
          activeColorRef.current = null;
        },
      }),
    [beginDrag, extendDrag, pointFromPage],
  );

  const endDrag = useCallback(() => {
    mouseIsDownRef.current = false;
    activeColorRef.current = null;
  }, []);

  const webCellHandlers = useCallback(
    (point: Point) =>
      Platform.OS === 'web'
        ? {
            onMouseDown: () => {
              mouseIsDownRef.current = true;
              beginDrag(point);
            },
            onMouseEnter: () => {
              if (mouseIsDownRef.current) {
                extendDrag(point);
              }
            },
            onMouseUp: () => {
              extendDrag(point);
              endDrag();
            },
          }
        : {},
    [beginDrag, endDrag, extendDrag],
  );

  const boardHandlers =
    Platform.OS === 'web'
      ? {
          onMouseLeave: endDrag,
          onMouseUp: endDrag,
        }
      : panResponder.panHandlers;

  const revealHint = () => {
    if (!level) {
      return;
    }

    if (!solution) {
      setMessage('This board is unsolvable.');
      Alert.alert('No solution', 'The solver could not find a valid full-board solution.');
      return;
    }

    const hint = findNextMove(level, paths, solution);
    if (!hint) {
      setMessage('No hint available.');
      return;
    }

    setPaths((current) => {
      const path = current[hint.colorId] ?? [hint.from];
      const last = path[path.length - 1];
      if (!samePoint(last, hint.from)) {
        return { ...current, [hint.colorId]: [hint.from, hint.to] };
      }
      return { ...current, [hint.colorId]: [...path, hint.to] };
    });
    setMessage(`Hint: extend ${hint.colorId}.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>LinkGrid</Text>
          <Text style={styles.subtitle}>Time: {won ? 'done' : formatElapsed(elapsedMs)}</Text>
        </View>

        <View style={styles.difficultyRow}>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => void loadLevel(item)}
              style={[styles.segment, difficulty === item && styles.segmentActive]}>
              <Text style={styles.segmentText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View
          {...boardHandlers}
          onLayout={(event) => {
            if (Platform.OS === 'web') {
              return;
            }

            event.currentTarget?.measure?.((_x, _y, _width, _height, pageX, pageY) => {
              boardOffsetRef.current = { x: pageX, y: pageY };
            });
          }}
          style={[styles.board, { width: boardSize, height: boardSize }]}>
          {Array.from({ length: (level?.size ?? 5) * (level?.size ?? 5) }).map((_, index) => {
            const size = level?.size ?? 5;
            const row = Math.floor(index / size);
            const col = index % size;
            const point = { row, col };
            const occupant = occupants.get(keyOf(point));
            const color = occupant?.color ?? '#FFFFFF';

            return (
              <View
                key={`${row}-${col}`}
                {...webCellHandlers(point)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: occupant?.isEndpoint ? '#FFFFFF' : color,
                  },
                ]}>
                {occupant?.isEndpoint ? (
                  <View style={[styles.endpoint, { backgroundColor: color }]}>
                    <Text style={styles.endpointText}>{occupant.colorId[0].toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={revealHint}>
            <Text style={styles.primaryButtonText}>Hint</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={resetBoard}>
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void loadLevel(difficulty)}>
            <Text style={styles.secondaryButtonText}>New</Text>
          </Pressable>
        </View>

        <View style={styles.scorePanel}>
          <Text style={styles.panelTitle}>Scoreboard</Text>
          {scores.length === 0 ? (
            <Text style={styles.emptyText}>No scores yet.</Text>
          ) : (
            scores.slice(0, 5).map((score, index) => (
              <View key={`${score.id}-${score.createdAt}-${score.elapsedMs}-${index}`} style={styles.scoreRow}>
                <Text style={styles.scoreName}>
                  {index + 1}. {score.playerName}
                </Text>
                <Text style={styles.scoreTime}>
                  {formatElapsed(score.elapsedMs)}
                  {score.pending ? ' saving' : score.failed ? ' local' : ''}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function mergeScores(scores: Score[], nextScore: Score) {
  return normalizeScores([nextScore, ...scores.filter((score) => score.id !== nextScore.id)]);
}

function normalizeScores(scores: Score[]) {
  const byId = new Map<string, Score>();

  for (const score of scores) {
    byId.set(score.id, score);
  }

  return Array.from(byId.values()).sort((a, b) => a.elapsedMs - b.elapsedMs);
}

function pointsBetween(from: Point, to: Point) {
  if (from.row !== to.row && from.col !== to.col) {
    return [to];
  }

  const rowStep = Math.sign(to.row - from.row);
  const colStep = Math.sign(to.col - from.col);
  const distance = Math.abs(to.row - from.row) + Math.abs(to.col - from.col);

  return Array.from({ length: distance }, (_, index) => ({
    row: from.row + rowStep * (index + 1),
    col: from.col + colStep * (index + 1),
  }));
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  header: {
    width: '100%',
    maxWidth: 430,
    gap: 4,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '400',
  },
  difficultyRow: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  segmentActive: {
    backgroundColor: '#E5E7EB',
  },
  segmentText: {
    color: '#111827',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: BOARD_BORDER_WIDTH,
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#111827',
  },
  endpoint: {
    width: '68%',
    height: '68%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#111827',
  },
  endpointText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  message: {
    width: '100%',
    maxWidth: 430,
    minHeight: 22,
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111827',
  },
  primaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  scorePanel: {
    width: '100%',
    maxWidth: 430,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#D0D5DD',
    paddingTop: 16,
  },
  panelTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#667085',
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
    alignItems: 'center',
  },
  scoreName: {
    color: '#111827',
    fontWeight: '600',
  },
  scoreTime: {
    color: '#4B5563',
    fontWeight: '600',
  },
});
