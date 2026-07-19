// Plain flat shapes for app.application / app.module / app.tool (the site-admin application tree).
// Distinct from ProfileClaims' ModuleInfo/ToolInfo (the auth-time nav projection) — deliberately
// not force-unified, per the fnb-types rollout decision.

export interface Application {
  key: string
  name: string
  licenseCount: number | null
}

export interface Module {
  key: string
  applicationKey: string | null
  name: string
  permissionKeys: string[] | null
  defaultIconKey: string | null
  ordinal: number | null
}

export interface Tool {
  key: string
  moduleKey: string | null
  name: string
  permissionKeys: string[] | null
  defaultIconKey: string | null
  route: string | null
  ordinal: number | null
}
