// Plain flat shapes for location_datasets.brewery (Open Brewery DB public dataset).

import type { Location } from '@/location'

// verbatim GraphQL enum values (UPPERCASE)
export type BreweryType =
  | 'UNKNOWN' // sync coerces unrecognized upstream values here; raw value lands in notes
  | 'MICRO'
  | 'NANO'
  | 'REGIONAL'
  | 'BREWPUB'
  | 'CONTRACT'
  | 'PROPRIETOR'
  | 'PLANNING'
  | 'CLOSED'
  | 'LARGE'
  | 'BAR'
  | 'TAPROOM'
  | 'BEERGARDEN'
  | 'CIDERY'
  | 'LOCATION'

export interface Brewery {
  id: string
  externalId: string
  name: string
  breweryType: BreweryType
  notes: string | null
  phone: string | null
  websiteUrl: string | null
  location: Location
  createdAt: Date
  updatedAt: Date
}

export interface BreweryMapPoint {
  id: string
  name: string
  breweryType: BreweryType
  lat: number
  lon: number
}

export interface BrewerySyncStatus {
  lastSyncedAt: Date | null
  breweryCount: number
  inProgress: boolean
}
