// Plain input shape for creating/updating a location (mirrors the GraphQL LocationInfoInput used
// by UI forms). Kept framework-agnostic so forms depend on fnb-types, not the generated input.

export interface LocationInfoInput {
  id?: string | null
  name?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  lat?: string | null
  lon?: string | null
}
