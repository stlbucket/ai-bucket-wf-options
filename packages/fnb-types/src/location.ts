// Plain flat shape for loc.location.

import type { Urn } from '@/urn'

export interface Location {
  id: string
  tenantId: string
  residentUrn: Urn | null // null on public dataset rows (is_public = true)
  name: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  lat: string | null
  lon: string | null
  isPublic: boolean
  isGeolocated: boolean // generated column: lat and lon both present
  urn: Urn
}
