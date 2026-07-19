import { useAuth as _useAuth } from '@function-bucket/fnb-auth-ui'
import type { ProfileClaims } from '@function-bucket/fnb-types'

export type { ProfileClaims }

export function useAuth() {
  return _useAuth()
}
