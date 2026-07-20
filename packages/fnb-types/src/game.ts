// Game server shared vocabulary (.claude/specs/game-server/_shared.data.md §fnb-types).
// Enums mirror GraphQL verbatim (UPPERCASE) — except game_type, which is NOT an enum:
// ids are lowercase citext registry keys that pass through as strings.

export type GameTypeId = 'battleship' | 'tic_tac_toe' | 'checkers'
export type GameTypeStatus = 'LIVE' | 'COMING_SOON' | 'RETIRED'
export type GameStatus = 'LOBBY' | 'IN_PROGRESS' | 'COMPLETE' | 'ABANDONED'
export type PlayerKind = 'HUMAN' | 'MACHINE_ALGORITHM' | 'MACHINE_AGENT'
export type GameEventType = 'SETUP' | 'MOVE' | 'RESIGN'
export type GameEventStatus = 'PENDING' | 'APPLIED' | 'REJECTED'
export type SeatOutcome = 'WON' | 'LOST' | 'DREW'

export interface GameTypeInfo {
  id: GameTypeId
  name: string
  description: string | null
  icon: string | null
  ordinal: number
  status: GameTypeStatus
  minPlayerSeats: number
  maxPlayerSeats: number
  supportedPlayerKinds: PlayerKind[]
  defaultConfig: unknown
}

export interface GamePlayer {
  seat: number
  playerKind: PlayerKind
  residentUrn: string | null // null ⟺ machine seat
  outcome: SeatOutcome | null // null until the game completes
  resignedAt: Date | null
}

// createGame input vocabulary — seats 2..N (the caller becomes seat 1)
export interface NewGamePlayer {
  kind: PlayerKind
  residentUrn?: string // required for HUMAN, absent for machine kinds
}

export interface GameSummary {
  id: string
  tenantId: string
  gameTypeId: GameTypeId
  status: GameStatus
  seatCount: number
  players: GamePlayer[] // from the Game.gamePlayers relation, ordered by seat
  expectingSeats: number[] // seats the game awaits events from ([] in lobby/terminal)
  eventCount: number // applied events = max event number (the scrubber's upper bound)
  createdAt: Date
  finishedAt: Date | null
}

export interface GameEvent {
  id: string
  gameId: string
  eventType: GameEventType
  seat: number | null // null for system events (setup)
  eventNumber: number | null // dense 1..N once applied
  eventData: unknown
  status: GameEventStatus
  rejectionReason: string | null
  createdAt: Date
}
