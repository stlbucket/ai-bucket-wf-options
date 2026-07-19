import type { AirportType } from '@function-bucket/fnb-types'

// type badge color map — .claude/specs/tenant-app/datasets/airports/index.ui.md
const AIRPORT_TYPE_COLORS: Record<
  AirportType,
  'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
> = {
  LARGE_AIRPORT: 'primary',
  MEDIUM_AIRPORT: 'secondary',
  SMALL_AIRPORT: 'success',
  HELIPORT: 'info',
  SEAPLANE_BASE: 'info',
  BALLOONPORT: 'neutral',
  CLOSED: 'error',
  UNKNOWN: 'warning', // coerced upstream drift — visible on purpose; raw value is in notes
}

export function airportTypeColor(type: AirportType) {
  return AIRPORT_TYPE_COLORS[type] ?? 'neutral'
}

// LARGE_AIRPORT → "Large airport"
export function airportTypeLabel(type: AirportType) {
  const lower = type.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
