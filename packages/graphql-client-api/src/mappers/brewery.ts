import type {
  BreweryFragment,
  BreweryMapPointFragment,
  BrewerySyncStatusQuery,
} from '../generated/fnb-graphql-api'
import type {
  Brewery,
  BreweryMapPoint,
  BrewerySyncStatus,
  BreweryType,
} from '@function-bucket/fnb-types'
import { toLocation } from './location'

export const toBrewery = (f: BreweryFragment): Brewery => ({
  id: String(f.id),
  externalId: f.externalId,
  name: String(f.name),
  breweryType: f.breweryType as unknown as BreweryType,
  notes: f.notes ?? null,
  phone: f.phone ?? null,
  websiteUrl: f.websiteUrl ?? null,
  location: toLocation(f.location!),
  createdAt: new Date(f.createdAt),
  updatedAt: new Date(f.updatedAt),
})

export const toBreweryMapPoint = (f: BreweryMapPointFragment): BreweryMapPoint => ({
  id: String(f.id),
  name: String(f.name),
  breweryType: f.breweryType as unknown as BreweryType,
  lat: parseFloat(String(f.lat)),
  lon: parseFloat(String(f.lon)),
})

export const toBrewerySyncStatus = (
  s: NonNullable<BrewerySyncStatusQuery['brewerySyncStatus']>,
): BrewerySyncStatus => ({
  lastSyncedAt: s.lastSyncedAt ? new Date(s.lastSyncedAt) : null,
  breweryCount: s.breweryCount ?? 0,
  inProgress: s.inProgress ?? false,
})
