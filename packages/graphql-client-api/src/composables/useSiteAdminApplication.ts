import { computed } from 'vue'
import type { Application, Module, Tool, LicenseType } from '@function-bucket/fnb-types'
import { useApplicationByKeyQuery } from '../generated/fnb-graphql-api'
import { toApplication } from '../mappers/application'
import { toLicenseType } from '../mappers/license-type'

// The application-tree license type carries its granted permission keys alongside the base type.
export interface LicenseTypeWithPermissions extends LicenseType {
  permissions: string[]
}

export interface ApplicationDetail {
  application: Application
  modules: Module[]
  tools: Tool[]
  licenseTypes: LicenseTypeWithPermissions[]
}

export function useSiteAdminApplication(key: string) {
  const { data, fetching, error } = useApplicationByKeyQuery({ variables: { key } })
  return {
    data: computed<ApplicationDetail | null>(() => {
      const app = data.value?.application
      if (!app) return null

      const modules: Module[] = app.modules.map((m) => ({
        key: m.key,
        applicationKey: app.key,
        name: m.name,
        permissionKeys: null,
        defaultIconKey: null,
        ordinal: m.ordinal ?? null,
      }))

      const tools: Tool[] = app.modules
        .flatMap((m) => m.tools)
        .map((t) => ({
          key: t.key,
          moduleKey: t.moduleKey ?? null,
          name: t.name,
          permissionKeys: (t.permissionKeys ?? null) as string[] | null,
          defaultIconKey: null,
          route: t.route ?? null,
          ordinal: null,
        }))

      const licenseTypes: LicenseTypeWithPermissions[] = app.licenseTypes.map((lt) => ({
        ...toLicenseType(lt),
        permissions: lt.permissions.map((p) => p.permissionKey),
      }))

      return { application: toApplication(app), modules, tools, licenseTypes }
    }),
    fetching,
    error,
  }
}
