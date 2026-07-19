// Fail-fast env reader: every config value comes from .env (no silent defaults). Throws on a
// missing/empty variable instead of running with a baked-in fallback.
export function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}
