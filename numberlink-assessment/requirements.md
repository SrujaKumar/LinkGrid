# React Native Take-Home Assessment

**Time Estimate:** 4 hours
**Required:** React Native (Expo preferred)
**Language:** TypeScript



## Technical Requirements

* **Language:** TypeScript (required)
* **Framework:** React Native (required)
* **Libraries:** Any third-party open source libraries are allowed
* **AI Tools:** AI tools (ChatGPT, Copilot, etc.) are allowed
* **Note:** You must be able to explain all submitted code during the follow-up interview



## Objective

Build a **Numberlink-style** 5x5 puzzle game in React Native.



## Game Rules

* The board is a 5x5 grid.
* The board contains multiple colored pairs (each color has exactly two endpoints).
* The player connects matching pairs with a continuous path.
* Paths:

  * Move only up, down, left, or right.
  * Cannot overlap or cross.
  * Cannot branch.
* The puzzle is complete when:

  * All pairs are connected.
  * The entire grid is filled.



# Requirements

## 1\. Core Gameplay

* Dynamic 5x5 board (no hardcoded layouts).
* Tap and drag interaction.
* Reset button.
* “You Win” state.



## 2\. Solver

```ts
solveLevel(level: Level): Solution | null
```

* Returns a valid full solution or `null`.
* Independent from React components.
* Used for validation and hints.

## 3\. API Integration (Nice to Have)

You will be provided a mock api served in a container.

Your app must:

* Fetch levels (`GET /levels`, `GET /levels/{levelId}`)
* Submit scores (`POST /scores`)
* Fetch scoreboard (`GET /scores?levelId={id}`)



## 4\. Hint System

* Add a “Hint” button.
* Reveal a single valid next move.
* Use solver output.
* Detect and notify if the board is unsolvable.



## 5\. Scoreboard (Nice to Have)

* Track elapsed time.
* On completion:

  * Immediately update the UI (optimistic update).
  * Then submit the score via API.
* Handle API failure gracefully.



## 6\. Procedural Level Generation (Nice to Have)

```ts
generateLevel({ size: 5, difficulty }): Level
```

* Support `easy`, `medium`, and `hard`.
* Generated levels must be solvable.
* Validate solvability before presenting.



## Deliverables

* Public GitHub repository
* README explaining:

  * Architecture decisions
  * Solver approach
  * Tradeoffs and incomplete areas

Be prepared to walk through and modify your solution during a follow-up interview.

