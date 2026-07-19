# PostGraphile 5: Customization Reference

## Smart Tags

Smart tags customize the GraphQL schema without changing your database structure.

### Application Methods (in priority order, lowest first)

1. **Default plugin behaviors** — what PostGraphile ships with
2. **`schema.defaultBehavior`** in preset — global overrides
3. **File-based tags** — keeps DB comments clean (see below)
4. **SQL `COMMENT ON`** — inline database comments (highest priority, most visible)

### SQL Comment Syntax

```sql
-- Single tag
comment on table users is E'@name person';

-- Multiple tags (newline-separated)
comment on table users is E'@name person\n@behavior -delete';

-- Multiple values on one tag
comment on column posts.status is E'@behavior +filter +orderBy';
```

### File-Based Smart Tags

`makePgSmartTagsFromFilePlugin` loads smart tags from a file. Supports both `.json5` and `.jsonc`
extensions (`.jsonc` is the more common choice in real projects):

```typescript
import { makePgSmartTagsFromFilePlugin } from "postgraphile/utils";
import { resolve } from "path";

const TagsFilePlugin = makePgSmartTagsFromFilePlugin(resolve("./db/tags.jsonc"));
```

Register it via `appendPlugins` (when using `makeV4Preset`) or `preset.plugins`.

### `postgraphile.tags.json5` / `tags.jsonc` Syntax

```json5
{
  version: 1,
  tags: {
    class: {
      users: {
        tags: { name: "person" },
        attribute: {
          created_at: { tags: { behavior: "-filter" } }
        }
      }
    },
    procedure: {
      register_user: { tags: { name: "signup" } }
    }
  }
}
```

## Smart Tags Reference

### Naming Tags

| Tag | Applies to | Effect |
|-----|-----------|--------|
| `@name newName` | table, view, type, function, column | Rename in GraphQL |
| `@fieldName newName` | function (computed col), FK relation | Rename the field |
| `@foreignFieldName newName` | FK constraint | Rename the reverse relation |
| `@resultFieldName newName` | mutation function | Rename the payload field |
| `@returnType TypeName` | function | Override return type |

### Behavior Tag

The `@behavior` tag is the most powerful — it controls what operations are exposed:

```sql
-- Disable all mutations on a table
comment on table audit_log is E'@behavior -insert -update -delete';

-- Enable list mode, disable connection (cursor pagination)
comment on table small_lookup is E'@behavior +list -connection';

-- Hide from schema entirely
comment on table internal_config is E'@behavior -*';

-- Allow filtering on a specific column
comment on column users.status is E'@behavior +filter';
```

### Constraint Tags (for views/materialized views)

```sql
-- Define primary key (required for nodeId, updates, deletes)
comment on view user_summary is E'@primaryKey id';

-- Define unique constraint
comment on view user_summary is E'@unique username';

-- Define virtual foreign key
comment on view post_summary is E'@foreignKey (author_id) references users (id)';

-- Mark column non-nullable
comment on column user_summary.username is E'@notNull';
```

### Polymorphism Tags

```sql
-- Single-table inheritance
comment on table items is E'@interface mode:single type:item_type\n@type TOPIC name:Topic\n@type POST name:Post';

-- Relational inheritance  
comment on table items is E'@interface mode:relational type:type\n@type TOPIC references:topics';

-- Union member
comment on table videos is E'@unionMember MediaResult';
```

### Deprecated V4 Tags → V5 Equivalents

| V4 | V5 |
|----|-----|
| `@omit` | `@behavior -*` |
| `@omit create,update` | `@behavior -insert -update` |
| `@simpleCollections only` | `@behavior +list -connection` |
| `@simpleCollections both` | `@behavior +list +connection` |
| `@sortable` | `@behavior +sort +orderBy` |
| `@filterable` | `@behavior +filter +filterBy` |

## Behavior System Deep Dive

### Core Behavior Strings

**CRUD operations:**
- `resource:select` — expose the type at all
- `resource:insert` — create mutations
- `resource:update` — update mutations
- `resource:delete` — delete mutations

**Query patterns:**
- `connection` — cursor-paginated connection
- `list` — simple array
- `resource:list:filter` — filter on list queries
- `resource:connection:order` — ordering on connections

**Mutations:**
- `insert:resource:select` — return the created row
- `update:resource:select` — return the updated row

**Aggregates:**
- `resource:aggregates` — count, sum, etc.
- `resource:groupedAggregates` — group by aggregates

**Relationships:**
- `singularRelation:resource:single` — forward FK (single record)
- `manyRelation:resource:list` — reverse FK (list)
- `manyRelation:resource:connection` — reverse FK (connection)

### Behavior Priority

Behaviors are resolved from a concatenated string, scanned **right to left** — last match wins:
1. Plugin defaults (lowest)
2. `schema.defaultBehavior` in preset
3. Inferred plugin behaviors
4. Secondary entity behaviors (e.g., column type)
5. Smart tags on entity (highest)

Debug with: `npx graphile behavior debug`

### Global Defaults

```javascript
// In graphile.config.mjs
const preset = {
  schema: {
    defaultBehavior: "-connection +list",  // all tables: lists not connections
  },
};
```

## Inflection (Naming Conventions)

### Default Naming

| DB object | GraphQL name |
|-----------|-------------|
| `forum_posts` table | `ForumPost` type, `allForumPosts` query |
| `created_at` column | `createdAt` field |
| FK `author_id → users.id` | `userByAuthorId` relation |
| `user_role` enum | `UserRole` with `ADMIN`, `USER` values |

### Simplify Inflection Plugin

Add `@graphile/simplify-inflection` to remove `ByColumnName` suffixes:
- `userByAuthorId` → `author`
- `postsByAuthorId` → `posts`
- `organizationByOrganizationId` → `organization`

```javascript
import SimplifyInflectionPlugin from "@graphile/simplify-inflection";
const preset = {
  plugins: [SimplifyInflectionPlugin],
  // ...
};
```

### Custom Inflectors

Override naming via a plugin:

```javascript
export const MyInflectionPlugin = {
  name: "MyInflectionPlugin",
  inflection: {
    replace: {
      // Rename patch input type: UserPatch → UserChangeSet
      patchType(previous, resolvedPreset, typeName) {
        return this.upperCamelCase(`${typeName}-change-set`);
      },
      // Rename a specific attribute
      attribute(previous, options, details) {
        if (details.attributeName === "full_name") return "name";
        return previous?.(details) ?? details.attributeName;
      },
    },
  },
};
```

List available inflectors: `npx graphile inflection list`

## Debugging Customizations

```bash
# See all active plugins and their config
npx graphile config print

# Trace how a behavior is resolved for an entity
npx graphile behavior debug

# List all inflectors with docs
npx graphile inflection list
```
