// Raw pg has no CamelCasePlugin (unlike fnb-db-types' Kysely client), so we camelCase the keys
// of `to_jsonb(...)` results ourselves. This recurses into nested objects/arrays, reproducing the
// behavior CamelCasePlugin gave for nested composites like ProfileClaims.modules[] / tools[]
// (see the camelcase_plugin_nested_keys note). Replaces the old parse-modules helper.

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

export function camelCaseKeys<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => camelCaseKeys(v)) as unknown as T
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[snakeToCamel(k)] = camelCaseKeys(v)
    }
    return out as T
  }
  return value as T
}
