# B4 — Module/Tool Navigation Structure (Anchor Application)

The anchor application defines the core platform navigation. Modules and tools are DB records
that drive both the nav UI and permission gating.

## Anchor Application Tree

```
anchor (application)
│
├── base-tools (module, permission: p:app-user, ordinal: 1)
│   └── profile (tool, permission: p:app-user, route: /profile, icon: i-lucide-user)
│
├── base-admin (module, permission: p:app-admin, ordinal: 2)
│   ├── users       (tool, permission: p:app-admin, route: /admin/user,         icon: i-lucide-users)
│   ├── licenses    (tool, permission: p:app-admin, route: /admin/license,      icon: i-lucide-key)
│   └── subscriptions (tool, permission: p:app-admin, route: /admin/subscription, icon: i-lucide-receipt)
│
└── base-site-admin (module, permission: p:app-admin-super, ordinal: 3)
    ├── tenants      (tool, permission: p:app-admin-super, route: /site-admin/tenant,      icon: i-lucide-building)
    ├── users        (tool, permission: p:app-admin-super, route: /site-admin/user,        icon: i-lucide-users)
    └── applications (tool, permission: p:app-admin-super, route: /site-admin/application, icon: i-lucide-layout-grid)
```

## How Nav Sections Are Built

1. `app.module` rows → nav sections (gated by module's permission_keys)
2. `app.tool` rows → nav items within each section (gated by tool's permission_keys)
3. The module/tool rows ride `ProfileClaims.modules` (fetched at auth time into localStorage)
4. `useAppNav().availableSections` (in `packages/tenant-layer`) derives the sections from those
   claims and orders them; RLS + permission gating already happened at the DB when claims were built

The DB records are the **single** source of truth (R14). There is **no** client-side registry:
the retired `nav-register.ts` / `useNavRegistry()` plugin pattern no longer exists anywhere in
code — nav is entirely claims-driven.

## Adding a New Module's Navigation

Each new module calls `app_fn.install_basic_application(...)` which creates the module and
tool DB records. The nav plugin in the corresponding layer then registers the section.
The nav UI reflects this automatically — no changes needed to the nav component itself.
