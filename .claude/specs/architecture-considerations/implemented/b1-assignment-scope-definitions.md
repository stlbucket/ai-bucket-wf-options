# B1 — Assignment Scope Definitions

The `assignment_scope` column on `app.license_type` controls how a license type can be granted.

| Scope | Meaning |
|-------|---------|
| `user` | Standard user access. Any number of residents can hold this license type independently. |
| `admin` | Admin access. Any number of residents in a tenant can independently hold this license type. One license_type per application can carry admin scope (structural constraint). |
| `superadmin` | Anchor tenant only; structurally locked to the anchor license pack |
| `support` | Anchor tenant only; structurally locked to the anchor license pack |
| `none` | Cannot be individually assigned; bundled automatically as part of a license pack |
| `all` | Auto-granted to every resident in the tenant on subscription |

## Two Levels of Uniqueness

`assignment_scope` imposes constraints at two distinct levels. These must not be confused.

### Level 1 — License Type Catalog (structural, DDL)

At most one `app.license_type` row per scope can exist per application. This is a catalog
constraint — it limits how many *kinds* of admin licenses are defined, not how many residents hold them.

Enforced by partial unique indexes on `app.license_type(application_key)`:

```sql
CREATE UNIQUE INDEX idx_uq_app_license_type_scope_admin
  ON app.license_type(application_key) WHERE assignment_scope = 'admin';

CREATE UNIQUE INDEX idx_uq_app_license_type_scope_user
  ON app.license_type(application_key) WHERE assignment_scope = 'user';

CREATE UNIQUE INDEX idx_uq_app_license_type_scope_superadmin
  ON app.license_type(application_key) WHERE assignment_scope = 'superadmin';

CREATE UNIQUE INDEX idx_uq_app_license_type_scope_support
  ON app.license_type(application_key) WHERE assignment_scope = 'support';
```

One admin-scope license type per application, one user-scope type per application, etc.
This says nothing about how many residents hold them.

### Level 2 — Per-Resident License Issuance (behavioral, function logic)

A single resident can hold at most one scoped license type at a time per application.
`app_fn.grant_user_license` enforces this — but it acts only on the **target resident**,
not on other residents. Multiple different residents in the same tenant can each
independently hold the same scoped license type.

## How `app_fn.grant_user_license` Handles Scoped Types

For `admin`, `user`, `superadmin`, `support` scopes:
1. Verifies caller is not the target (self-modification prevention)
2. **Deletes all** existing scoped (`admin`, `user`, `superadmin`, `support`) licenses for
   the **target resident** in this application — not just the same scope, all of them
3. Inserts the new license

A resident who had `user`-scope and is promoted to `admin` loses their `user` license.
Other residents' licenses are unaffected.
