import type {
  AirportFragment,
  AirportFrequencyFragment,
  AirportMapPointFragment,
  AirportSyncStatusQuery,
  NavaidFragment,
  RunwayFragment,
} from '../generated/fnb-graphql-api'
import type {
  Airport,
  AirportFrequency,
  AirportMapPoint,
  AirportSyncStatus,
  AirportType,
  Continent,
  Navaid,
  NavaidPower,
  NavaidType,
  NavaidUsageType,
  Runway,
} from '@function-bucket/fnb-types'
import { toLocation } from './location'

export const toAirport = (f: AirportFragment): Airport => ({
  id: String(f.id),
  externalId: f.externalId,
  ident: String(f.ident),
  type: f.type as unknown as AirportType,
  name: String(f.name),
  elevationFt: f.elevationFt ?? null,
  continent: f.continent as unknown as Continent,
  isoCountry: String(f.isoCountry),
  isoRegion: String(f.isoRegion),
  scheduledService: f.scheduledService,
  icaoCode: f.icaoCode ?? null,
  iataCode: f.iataCode ?? null,
  gpsCode: f.gpsCode ?? null,
  localCode: f.localCode ?? null,
  homeLink: f.homeLink ?? null,
  wikipediaLink: f.wikipediaLink ?? null,
  keywords: f.keywords ?? null,
  notes: f.notes ?? null,
  location: toLocation(f.location!),
  createdAt: new Date(f.createdAt),
  updatedAt: new Date(f.updatedAt),
})

export const toRunway = (f: RunwayFragment): Runway => ({
  id: String(f.id),
  externalId: f.externalId,
  lengthFt: f.lengthFt ?? null,
  widthFt: f.widthFt ?? null,
  surface: f.surface ?? null,
  lighted: f.lighted,
  closed: f.closed,
  leIdent: f.leIdent ?? null,
  leLatitudeDeg: f.leLatitudeDeg ?? null,
  leLongitudeDeg: f.leLongitudeDeg ?? null,
  leElevationFt: f.leElevationFt ?? null,
  leHeadingDegT: f.leHeadingDegT ?? null,
  leDisplacedThresholdFt: f.leDisplacedThresholdFt ?? null,
  heIdent: f.heIdent ?? null,
  heLatitudeDeg: f.heLatitudeDeg ?? null,
  heLongitudeDeg: f.heLongitudeDeg ?? null,
  heElevationFt: f.heElevationFt ?? null,
  heHeadingDegT: f.heHeadingDegT ?? null,
  heDisplacedThresholdFt: f.heDisplacedThresholdFt ?? null,
})

export const toAirportFrequency = (f: AirportFrequencyFragment): AirportFrequency => ({
  id: String(f.id),
  externalId: f.externalId,
  type: f.type ?? null,
  description: f.description ?? null,
  frequencyMhz: f.frequencyMhz != null ? Number(f.frequencyMhz) : null,
})

export const toNavaid = (f: NavaidFragment): Navaid => ({
  id: String(f.id),
  externalId: f.externalId,
  ident: f.ident ?? null,
  name: String(f.name),
  type: f.type as unknown as NavaidType,
  frequencyKhz: f.frequencyKhz != null ? Number(f.frequencyKhz) : null,
  latitudeDeg: f.latitudeDeg ?? null,
  longitudeDeg: f.longitudeDeg ?? null,
  elevationFt: f.elevationFt ?? null,
  isoCountry: f.isoCountry ?? null,
  dmeFrequencyKhz: f.dmeFrequencyKhz != null ? Number(f.dmeFrequencyKhz) : null,
  dmeChannel: f.dmeChannel ?? null,
  dmeLatitudeDeg: f.dmeLatitudeDeg ?? null,
  dmeLongitudeDeg: f.dmeLongitudeDeg ?? null,
  dmeElevationFt: f.dmeElevationFt ?? null,
  slavedVariationDeg: f.slavedVariationDeg != null ? Number(f.slavedVariationDeg) : null,
  magneticVariationDeg: f.magneticVariationDeg != null ? Number(f.magneticVariationDeg) : null,
  usageType: f.usageType as unknown as NavaidUsageType,
  power: f.power as unknown as NavaidPower,
  associatedAirportIdent: f.associatedAirportIdent ?? null,
})

export const toAirportMapPoint = (f: AirportMapPointFragment): AirportMapPoint => ({
  id: String(f.id),
  ident: String(f.ident),
  name: String(f.name),
  type: f.type as unknown as AirportType,
  iataCode: f.iataCode ?? null,
  lat: parseFloat(String(f.lat)),
  lon: parseFloat(String(f.lon)),
})

export const toAirportSyncStatus = (
  s: NonNullable<AirportSyncStatusQuery['airportSyncStatus']>,
): AirportSyncStatus => ({
  lastSyncedAt: s.lastSyncedAt ? new Date(s.lastSyncedAt) : null,
  airportCount: s.airportCount ?? 0,
  runwayCount: s.runwayCount ?? 0,
  frequencyCount: s.frequencyCount ?? 0,
  navaidCount: s.navaidCount ?? 0,
  countryCount: s.countryCount ?? 0,
  regionCount: s.regionCount ?? 0,
  inProgress: s.inProgress ?? false,
})
