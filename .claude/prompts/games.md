

spec out the full stack for a new generic game server

- should support multiple game types (battleship, tic-tac-toe, checkers, ...)
- db level should be game-type agnostic, just a record with a json field for the current game state
- games could be either between two users of the app or between a player and the machine
-- if against the machine, can be either algorithm or agent
- the game server should be implemented similarly to the msg server, with real-time updates of game state pushed to each player via websockets
- there should be an n8n workflow that manages the gameplay, looping on move updates until completion.
-- if the game is against the machine and algorithm, a new script (you write it) to select and apply a move should be run (apply function is below)
-- if the game is against the machine and agent, then a call to the anthropic api (from n8n, but use credentials as in our agentic workflow) should determine the next move
-- game state should be recorded on each move, triggering pg_notify, etc
- a new menu section called 'Games', with a tool for each game type
- only implement the battleship game.  list + detail.  other games should just have a 'Coming Soon' banner.



below is a typescript you generted for applying moves in battleship.  use it:

```
// battleship.ts
// A minimal, functional single-board Battleship engine.
// applyMove(gameState, move) => new gameState (immutable, no mutation of input)

export const BOARD_SIZE = 10;

export type CellStatus = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export interface ShipSpec {
  name: string;
  size: number;
}

export const DEFAULT_FLEET: ShipSpec[] = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 },
];

export interface PlacedShip {
  name: string;
  size: number;
  // cells occupied by this ship, in order
  cells: Array<{ row: number; col: number }>;
  hits: Set<string>; // "row,col" keys that have been hit
}

export interface GameState {
  board: CellStatus[][]; // BOARD_SIZE x BOARD_SIZE, viewer-facing status
  ships: PlacedShip[];
  shotsFired: Array<{ row: number; col: number }>;
  status: 'in_progress' | 'won';
}

export interface Move {
  row: number;
  col: number;
}

// ---------- helpers ----------

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function emptyBoard(): CellStatus[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 'empty' as CellStatus)
  );
}

function cloneGameState(state: GameState): GameState {
  return {
    board: state.board.map((row) => [...row]),
    ships: state.ships.map((s) => ({
      ...s,
      cells: s.cells.map((c) => ({ ...c })),
      hits: new Set(s.hits),
    })),
    shotsFired: state.shotsFired.map((m) => ({ ...m })),
    status: state.status,
  };
}

// ---------- random initial placement ----------

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function tryPlaceShip(
  occupied: Set<string>,
  spec: ShipSpec
): Array<{ row: number; col: number }> | null {
  const horizontal = Math.random() < 0.5;
  const maxRow = horizontal ? BOARD_SIZE : BOARD_SIZE - spec.size;
  const maxCol = horizontal ? BOARD_SIZE - spec.size : BOARD_SIZE;
  if (maxRow <= 0 || maxCol <= 0) return null;

  const startRow = randomInt(maxRow);
  const startCol = randomInt(maxCol);

  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < spec.size; i++) {
    const row = horizontal ? startRow : startRow + i;
    const col = horizontal ? startCol + i : startCol;
    if (!inBounds(row, col) || occupied.has(key(row, col))) {
      return null;
    }
    cells.push({ row, col });
  }
  return cells;
}

/**
 * Creates a fresh GameState with the given fleet placed randomly
 * (no overlaps, placements are straight lines, no adjacency rule enforced).
 */
export function createInitialGameState(
  fleet: ShipSpec[] = DEFAULT_FLEET
): GameState {
  const occupied = new Set<string>();
  const ships: PlacedShip[] = [];

  for (const spec of fleet) {
    let cells: Array<{ row: number; col: number }> | null = null;
    let attempts = 0;
    while (!cells && attempts < 500) {
      cells = tryPlaceShip(occupied, spec);
      attempts++;
    }
    if (!cells) {
      throw new Error(`Failed to place ship: ${spec.name}`);
    }
    cells.forEach((c) => occupied.add(key(c.row, c.col)));
    ships.push({ name: spec.name, size: spec.size, cells, hits: new Set() });
  }

  return {
    board: emptyBoard(),
    ships,
    shotsFired: [],
    status: 'in_progress',
  };
}

// ---------- move application ----------

/**
 * Applies a move (a shot at row/col) to a GameState and returns a NEW GameState.
 * Does not mutate the input. Throws on out-of-bounds or repeat-shot moves.
 */
export function applyMove(gameState: GameState, move: Move): GameState {
  const { row, col } = move;

  if (!inBounds(row, col)) {
    throw new Error(`Move out of bounds: (${row}, ${col})`);
  }
  if (gameState.status === 'won') {
    throw new Error('Game is already over');
  }
  if (gameState.shotsFired.some((m) => m.row === row && m.col === col)) {
    throw new Error(`Cell (${row}, ${col}) has already been fired upon`);
  }

  const next = cloneGameState(gameState);
  next.shotsFired.push({ row, col });

  const targetShip = next.ships.find((s) =>
    s.cells.some((c) => c.row === row && c.col === col)
  );

  if (!targetShip) {
    next.board[row][col] = 'miss';
    return next;
  }

  targetShip.hits.add(key(row, col));
  const sunk = targetShip.hits.size === targetShip.size;

  if (sunk) {
    targetShip.cells.forEach((c) => {
      next.board[c.row][c.col] = 'sunk';
    });
  } else {
    next.board[row][col] = 'hit';
  }

  const allSunk = next.ships.every((s) => s.hits.size === s.size);
  if (allSunk) {
    next.status = 'won';
  }

  return next;
}

// ---------- example usage ----------
//
// let state = createInitialGameState();
// state = applyMove(state, { row: 3, col: 4 });
// console.log(state.board[3][4]); // 'hit' | 'miss'
```