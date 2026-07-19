import type { LocationFragment } from '../generated/fnb-graphql-api'
import type { Location, Urn } from '@function-bucket/fnb-types'

export const toLocation = (f: LocationFragment): Location => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  residentUrn: f.residentUrn ? (String(f.residentUrn) as Urn) : null,
  name: f.name ?? null,
  address1: f.address1 ?? null,
  address2: f.address2 ?? null,
  city: f.city ?? null,
  state: f.state ?? null,
  postalCode: f.postalCode ?? null,
  country: f.country ?? null,
  lat: f.lat ?? null,
  lon: f.lon ?? null,
  isPublic: f.isPublic,
  isGeolocated: f.isGeolocated ?? false,
  urn: String(f.urn) as Urn,
})
