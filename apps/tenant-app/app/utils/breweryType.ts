import type { BreweryType } from '@function-bucket/fnb-types'

// type badge color map — .claude/specs/tenant-app/datasets/breweries/index.ui.md
const BREWERY_TYPE_COLORS: Record<
  BreweryType,
  'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
> = {
  MICRO: 'primary',
  BREWPUB: 'success',
  REGIONAL: 'secondary',
  LARGE: 'secondary',
  NANO: 'info',
  PLANNING: 'warning',
  CLOSED: 'error',
  CONTRACT: 'neutral',
  PROPRIETOR: 'neutral',
  BAR: 'neutral',
  TAPROOM: 'success',
  BEERGARDEN: 'success',
  CIDERY: 'info',
  LOCATION: 'neutral',
  UNKNOWN: 'warning', // coerced upstream drift — visible on purpose; raw value is in notes
}

export function breweryTypeColor(type: BreweryType) {
  return BREWERY_TYPE_COLORS[type] ?? 'neutral'
}

export function breweryTypeLabel(type: BreweryType) {
  return type.toLowerCase()
}
