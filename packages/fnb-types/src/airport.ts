// Plain flat shapes for the airports schema (OurAirports public dataset — no API, bulk CSVs).

import type { Location } from '@/location'

// verbatim GraphQL enum values (UPPERCASE); 'UNKNOWN' is the drift-coercion sentinel
export type AirportType =
  | 'UNKNOWN' // sync coerces unrecognized upstream values here; raw value lands in notes
  | 'BALLOONPORT'
  | 'CLOSED'
  | 'HELIPORT'
  | 'LARGE_AIRPORT'
  | 'MEDIUM_AIRPORT'
  | 'SEAPLANE_BASE'
  | 'SMALL_AIRPORT'

export type Continent = 'UNKNOWN' | 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA'

export type NavaidType =
  | 'UNKNOWN'
  | 'NDB'
  | 'NDB_DME'
  | 'DME'
  | 'VOR'
  | 'VOR_DME'
  | 'VORTAC'
  | 'TACAN'

export type NavaidUsageType = 'UNKNOWN' | 'LO' | 'HI' | 'BOTH' | 'TERMINAL' | 'RNAV'

export type NavaidPower = 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH'

export interface Airport {
  id: string
  externalId: number
  ident: string
  type: AirportType
  name: string
  elevationFt: number | null
  continent: Continent
  isoCountry: string
  isoRegion: string
  scheduledService: boolean
  icaoCode: string | null
  iataCode: string | null
  gpsCode: string | null
  localCode: string | null
  homeLink: string | null
  wikipediaLink: string | null
  keywords: string | null
  notes: string | null
  location: Location // the airport's public loc.location row (name/city/state/country/lat/lon)
  createdAt: Date
  updatedAt: Date
}

export interface Runway {
  id: string
  externalId: number
  lengthFt: number | null
  widthFt: number | null
  surface: string | null // free text upstream (664 distinct values) — not an enum
  lighted: boolean
  closed: boolean
  leIdent: string | null
  leLatitudeDeg: string | null // text like loc lat/lon; ~67% empty upstream
  leLongitudeDeg: string | null
  leElevationFt: number | null
  leHeadingDegT: number | null
  leDisplacedThresholdFt: number | null
  heIdent: string | null
  heLatitudeDeg: string | null
  heLongitudeDeg: string | null
  heElevationFt: number | null
  heHeadingDegT: number | null
  heDisplacedThresholdFt: number | null
}

export interface AirportFrequency {
  id: string
  externalId: number
  type: string | null // free text upstream (549 distinct values) — not an enum
  description: string | null
  frequencyMhz: number | null
}

export interface Navaid {
  id: string
  externalId: number
  ident: string | null
  name: string
  type: NavaidType
  frequencyKhz: number | null
  latitudeDeg: string | null
  longitudeDeg: string | null
  elevationFt: number | null
  isoCountry: string | null
  dmeFrequencyKhz: number | null
  dmeChannel: string | null
  dmeLatitudeDeg: string | null
  dmeLongitudeDeg: string | null
  dmeElevationFt: number | null
  slavedVariationDeg: number | null
  magneticVariationDeg: number | null
  usageType: NavaidUsageType
  power: NavaidPower
  associatedAirportIdent: string | null
}

export interface AirportMapPoint {
  id: string
  ident: string
  name: string
  type: AirportType
  iataCode: string | null
  lat: number
  lon: number
}

export interface AirportSyncStatus {
  lastSyncedAt: Date | null
  airportCount: number
  runwayCount: number
  frequencyCount: number
  navaidCount: number
  countryCount: number
  regionCount: number
  inProgress: boolean
}
