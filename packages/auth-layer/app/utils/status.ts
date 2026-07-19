// Shared status formatting for badges/pills across all apps.
// Auto-imported (Nuxt layer `app/utils`) — no import needed in components.
//
// Two concerns, deliberately separate:
//  - statusLabel: humanize a raw enum for display (never render raw enums).
//  - statusColor: map a status to a Nuxt UI badge color, per entity.
//
// Casing note: todo statuses arrive UPPERCASE from the GraphQL API while every
// other entity is lowercase from the DB — both are normalized here.

export type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export type StatusEntity =
  | 'todo'
  | 'license'
  | 'tenant'
  | 'resident'
  | 'profile'
  | 'ticket'
  | 'subscription'
  | 'workflow'
  | 'topic'
  | 'asset'

const normalize = (status: string): string => status.trim().toLowerCase()

/**
 * Humanize a raw status/enum value for display.
 * `INCOMPLETE` → `Incomplete` · `blocked_individual` → `Blocked Individual` · `TRIGGER_SET` → `Trigger Set`
 */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return ''
  return String(status)
    .trim()
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Per-entity maps — semantics differ (ticket `closed` → neutral, license `expired` → error),
// so a single global table won't do. Collapsed from the ~13 local copies across the codebase.
const colorMaps: Record<StatusEntity, Record<string, StatusColor>> = {
  todo: {
    incomplete: 'warning',
    unfinished: 'warning',
    complete: 'success',
    archived: 'neutral'
  },
  license: {
    active: 'success',
    inactive: 'neutral',
    expired: 'error'
  },
  tenant: {
    active: 'success',
    paused: 'warning',
    inactive: 'neutral'
  },
  resident: {
    active: 'success',
    supporting: 'success',
    invited: 'warning',
    declined: 'neutral',
    inactive: 'neutral',
    blocked_individual: 'error',
    blocked_tenant: 'error'
  },
  profile: {
    active: 'success',
    inactive: 'neutral',
    blocked: 'error'
  },
  ticket: {
    open: 'info',
    closed: 'neutral',
    deleted: 'error',
    duplicate: 'warning',
    parked: 'warning'
  },
  subscription: {
    active: 'success',
    inactive: 'neutral'
  },
  workflow: {
    complete: 'success',
    error: 'error',
    waiting: 'warning',
    paused: 'warning',
    trigger_set: 'warning'
  },
  topic: {
    open: 'info',
    locked: 'warning',
    closed: 'neutral'
  },
  // asset scan_status (quarantine-first): pending is the normal initial state.
  // Values arrive UPPERCASE from GraphQL (fnb-types); normalize() lowercases them.
  asset: {
    pending: 'neutral',
    clean: 'success',
    infected: 'error',
    error: 'warning'
  }
}

/**
 * Nuxt UI badge color for a given entity's status. Unknown values fall back to neutral.
 */
export function statusColor(entity: StatusEntity, status: string | null | undefined): StatusColor {
  if (!status) return 'neutral'
  return colorMaps[entity]?.[normalize(status)] ?? 'neutral'
}
