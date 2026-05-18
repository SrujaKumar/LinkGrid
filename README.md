# LinkGrid

Numberlink-style 5x5 puzzle game built with React Native, Expo, and TypeScript.

## Run

```bash
npm install
npm run android
```

For web:

```bash
npm run web
```

The provided mock API runs on port `4010`, so for web use:

```bash
EXPO_PUBLIC_API_URL=http://localhost:4010
```

For the Android emulator, use the host alias:

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:4010
```

The app can run with or without the mock API. Easy levels try the API first. Medium and hard levels use generated local data because the provided mock API does not return reliable detail data for those difficulties. If the API is down, easy also falls back to local data.

## Architecture

- `src/app/index.tsx` has the screen UI, drag handling, timer, hint button, reset button, and scoreboard.
- `src/game/types.ts` contains the shared game types.
- `src/game/solver.ts` has `solveLevel(level): Solution | null`. It does not import React.
- `src/game/generator.ts` has `generateLevel({ size: 5, difficulty })`.
- `src/game/api.ts` wraps the provided `/levels` and `/scores` endpoints from `mock-api/openapi.yaml`.
- `src/game/grid.ts` contains small grid helpers used by the UI and solver.

The API uses `{ x, y }` cells and `pairs`; the board code uses `{ row, col }` internally. `src/game/api.ts` is the adapter between those shapes.

Current level loading flow:

- `easy`: try `GET /levels`, then `GET /levels/{levelId}`. If that fails, use the local example.
- `medium`: use a generated local level.
- `hard`: use a generated local level.

## Solver Approach

The solver uses depth-first backtracking:

1. Group endpoints by color.
2. Try the shortest endpoint pairs first.
3. Extend the current color one up/down/left/right cell at a time.
4. Skip occupied cells and other colors' endpoints.
5. Move to the next color once the current pair is connected.
6. Return a solution only when every color is connected and all 25 cells are filled.

There is a search step cap so a bad API level does not hang the app. Hints use the solved path and reveal one next cell.

## Procedural Generation

The generator first builds a randomized path that visits all cells. It then splits that path into color segments and only exposes the segment endpoints. Before returning the level, it runs the solver as a validation step.

Difficulty currently changes the number and length of color pairs:

- `easy`: 3 pairs
- `medium`: 4 pairs
- `hard`: 5 pairs

## API Behavior

Implemented endpoints:

- `GET /levels`
- `GET /levels/{levelId}`
- `POST /scores`
- `GET /scores?levelId={id}`

Scores are optimistic: the UI shows the score immediately, then replaces it with the API response. If submission fails, the score stays visible and is marked as local.

## Tradeoffs

- Paths are shown as filled cells instead of pipe graphics. I chose that to keep touch handling and state updates straightforward.
- Generated levels are checked for solvability, but I do not check for uniqueness.
- The API client handles the mock API shape, but medium and hard are local because the mock detail endpoint is not reliable for them.
- The solver is tuned for 5x5 boards, not large Numberlink puzzles.
