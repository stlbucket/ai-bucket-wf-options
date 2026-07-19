// URN vocabulary for the res.resource registry (.claude/specs/urn-registry/).
// Grammar (frozen): urn:fnb:{tenant_id}:{module}:{type}:{id} — mirrors res_fn.build_urn.
// These helpers are the spec-authorized runtime exception to fnb-types' type-only rule:
// pure functions, zero dependencies.

export type Urn = string & { readonly __brand: 'Urn' }

export interface ParsedUrn {
  tenantId: string
  module: string
  resourceType: string
  id: string
}

export interface Resource {
  id: string
  tenantId: string
  module: string
  resourceType: string
  urn: Urn
  createdAt: Date
  createdByResidentId: string | null
  archivedAt: Date | null
}

const URN_PATTERN = /^urn:fnb:([^:]+):([^:]+):([^:]+):([^:]+)$/

export function isUrn(value: string): value is Urn {
  return URN_PATTERN.test(value)
}

export function parseUrn(urn: string): ParsedUrn | null {
  const m = URN_PATTERN.exec(urn)
  if (!m) return null
  const [, tenantId, module, resourceType, id] = m
  return { tenantId: tenantId!, module: module!, resourceType: resourceType!, id: id! }
}

export function formatUrn(parts: ParsedUrn): Urn {
  return `urn:fnb:${parts.tenantId}:${parts.module}:${parts.resourceType}:${parts.id}` as Urn
}
