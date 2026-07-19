import type { ProfileFragment } from '../generated/fnb-graphql-api'
import type { Profile, ProfileStatus } from '@function-bucket/fnb-types'

export const toProfile = (f: ProfileFragment): Profile => ({
  id: String(f.id),
  email: f.email,
  identifier: f.identifier ?? null,
  firstName: f.firstName ?? null,
  lastName: f.lastName ?? null,
  fullName: f.fullName ?? null,
  phone: f.phone ?? null,
  displayName: f.displayName ?? null,
  avatarKey: f.avatarKey ?? null,
  isPublic: f.isPublic,
  status: f.status as unknown as ProfileStatus,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})
