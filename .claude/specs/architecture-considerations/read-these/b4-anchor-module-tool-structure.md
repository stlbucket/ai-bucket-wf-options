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
3. Nav registration plugins (`nav-register.ts`) use `useNavRegistry().register()`
4. `useAppNav().availableSections` filters at runtime against `useAuth().user.permissions`

The DB records are the source of truth for what exists. The nav-register plugin in each
layer/app is the mechanism that surfaces them to the UI. See b6-nav-section-registration.md
for the plugin pattern.

## Adding a New Module's Navigation

Each new module calls `app_fn.install_basic_application(...)` which creates the module and
tool DB records. The nav plugin in the corresponding layer then registers the section.
The nav UI reflects this automatically — no changes needed to the nav component itself.
