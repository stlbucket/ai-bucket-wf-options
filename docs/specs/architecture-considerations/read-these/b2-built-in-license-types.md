# B2 — Built-in License Types Reference

These license types ship with the `anchor` application and are created by
`db/fnb-app/deploy/00000000010260_app_bootstrap.sql`.

## Anchor Application License Types

| Key | Permissions Granted | Scope | Pack |
|-----|---------------------|-------|------|
| `app-user` | `p:app-user` | user | base |
| `app-admin` | `p:app-user`, `p:app-admin` | admin | base |
| `app-admin-super` | `p:app-user`, `p:app-admin`, `p:app-admin-super` | superadmin | anchor |
| `app-admin-support` | `p:app-user`, `p:app-admin`, `p:app-admin-support` | support | anchor |
| `app-address-book` | `p:address-book` | user | base |

## Notes

- `app-admin` includes `p:app-user` — admins are always also users, no need to hold both licenses
- `app-admin-super` includes both `p:app-admin` and `p:app-user` — super admins have all lower permissions
- `app-admin-super` and `app-admin-support` are locked to the `anchor` pack by partial unique indexes (see c1-anchor-tenant-unique-indexes.md)
- `app-address-book` is an example of a non-admin user-scope feature permission

## Module License Types (by module)

Each module registered via `app_fn.install_basic_application` gets two license types:

| Module | User Type | Admin Type |
|--------|-----------|------------|
| msg (discussions) | `msg-app` → `p:discussions` | `msg-app-admin` → `p:discussions-admin` |
| todo | `todo-app` → `p:todo` | `todo-app-admin` → `p:todo-admin` |
| loc | `loc-app` → `p:loc` | `loc-app-admin` → `p:loc-admin` |

Both are created automatically by `install_basic_application` with appropriate scope
(`user` and `admin` respectively).
