// Plain flat shape for app.profile. status reuses ProfileStatus (mirrors the GraphQL
// ProfileStatus enum, UPPERCASE) — the same vocabulary ProfileClaims uses.

import type { ProfileStatus } from '@/profile-claims'

export interface Profile {
  id: string
  email: string
  identifier: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  phone: string | null
  displayName: string | null
  avatarKey: string | null
  isPublic: boolean
  status: ProfileStatus
  createdAt: Date
  updatedAt: Date
}
