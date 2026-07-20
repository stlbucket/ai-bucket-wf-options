import type {
  GameEvent,
  GameEventStatus,
  GameEventType,
  GamePlayer,
  GameStatus,
  GameSummary,
  GameTypeId,
  GameTypeInfo,
  GameTypeStatus,
  PlayerKind,
  SeatOutcome,
} from '@function-bucket/fnb-types'

// Structural shapes — match both MyGamesQuery's and GameById's inline `game` selections
// (no shared .graphql fragment; both operations select the same summary fields — R3).
interface GamePlayerFragment {
  seat: number
  playerKind: string
  residentUrn?: string | null
  outcome?: string | null
  resignedAt?: unknown | null
}

interface GameSummaryFragment {
  id: unknown
  tenantId: unknown
  gameTypeId: string
  status: string
  seatCount: number
  expectingSeats: Array<number | null>
  eventCount: number
  createdAt: unknown
  finishedAt?: unknown | null
  gamePlayersList: GamePlayerFragment[]
}

interface GameEventFragment {
  id: unknown
  gameId: unknown
  eventType: string
  seat?: number | null
  eventNumber?: number | null
  eventData: unknown
  status: string
  rejectionReason?: string | null
  createdAt: unknown
}

interface GameTypeFragment {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  ordinal: number
  status: string
  minPlayerSeats: number
  maxPlayerSeats: number
  supportedPlayerKinds: Array<string | null>
  defaultConfig: unknown
}

export const toGamePlayer = (f: GamePlayerFragment): GamePlayer => ({
  seat: f.seat,
  playerKind: f.playerKind as PlayerKind,
  residentUrn: f.residentUrn ?? null,
  outcome: (f.outcome as SeatOutcome | null) ?? null,
  resignedAt: f.resignedAt ? new Date(String(f.resignedAt)) : null,
})

export const toGameSummary = (f: GameSummaryFragment): GameSummary => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  gameTypeId: f.gameTypeId as GameTypeId,
  status: f.status as GameStatus,
  seatCount: f.seatCount,
  players: (f.gamePlayersList ?? []).map(toGamePlayer).sort((a, b) => a.seat - b.seat),
  expectingSeats: (f.expectingSeats ?? []).filter((s): s is number => s != null),
  eventCount: f.eventCount,
  createdAt: new Date(String(f.createdAt)),
  finishedAt: f.finishedAt ? new Date(String(f.finishedAt)) : null,
})

export const toGameEvent = (f: GameEventFragment): GameEvent => ({
  id: String(f.id),
  gameId: String(f.gameId),
  eventType: f.eventType as GameEventType,
  seat: f.seat ?? null,
  eventNumber: f.eventNumber ?? null,
  eventData: f.eventData,
  status: f.status as GameEventStatus,
  rejectionReason: f.rejectionReason ?? null,
  createdAt: new Date(String(f.createdAt)),
})

export const toGameTypeInfo = (f: GameTypeFragment): GameTypeInfo => ({
  id: f.id as GameTypeId,
  name: f.name,
  description: f.description ?? null,
  icon: f.icon ?? null,
  ordinal: f.ordinal,
  status: f.status as GameTypeStatus,
  minPlayerSeats: f.minPlayerSeats,
  maxPlayerSeats: f.maxPlayerSeats,
  supportedPlayerKinds: (f.supportedPlayerKinds ?? []).filter((k): k is string => k != null).map((k) => k as PlayerKind),
  defaultConfig: f.defaultConfig,
})
