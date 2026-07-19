# PostGraphile 5: Schema Design Reference

## PostgreSQL → GraphQL Mapping

### Tables

A table `public.forum_post` automatically generates:

| PostgreSQL | GraphQL |
|-----------|---------|
| Table `forum_post` | Type `ForumPost`, connection `allForumPosts`, query `forumPostById` |
| Column `author_id` | Field `authorId` (camelCase) |
| FK `author_id → users.id` | Relation field `userByAuthorId` (or `author` with simplify-inflection) |
| Reverse FK | `forumPostsByAuthorId` on `User` (or `forumPosts` with simplify) |
| Primary key | `nodeId` global identifier + `forumPostById(id: Int!)` query |
| CRUD access | `createForumPost`, `updateForumPost`, `deleteForumPost` mutations |

**With `@graphile/simplify-inflection`** (strongly recommended):
- `userByAuthorId` → `author`
- `forumPostsByAuthorId` → `forumPosts`
- Much cleaner schema for humans

### Views

Views work like tables but with important limitations:
- **No automatic PK inference** → must add `@primaryKey col` smart tag
- **All columns nullable** → add `@notNull` smart tag as needed
- **No FK inference** → must add `@foreignKey (col) references table` smart tag
- **No mutations by default** (PostgreSQL can support updatable views but needs explicit setup)

When to use views:
- Expose pre-computed/filtered data without mutations
- Flatten multi-table joins into a simpler type
- Row-level security via `security_barrier` views
- Maintain stable API surface while restructuring underlying tables

### Functions

**Computed columns** (attach a field to an existing type):
```sql
-- Adds field `fullName` to `User` type
create function full_name(u users) returns text
  language sql stable
  as $$ select u.first_name || ' ' || u.last_name $$;
```

**Custom queries** (STABLE or IMMUTABLE → root Query field):
```sql
-- Adds query `searchUsers(query: String): UsersConnection`
create function search_users(query text)
  returns setof users
  language sql stable
  as $$ select * from users where name ilike '%' || query || '%' $$;
```

**Custom mutations** (VOLATILE → root Mutation field):
```sql
-- Adds mutation `registerUser(username: String!, email: String!): User`
create function register_user(username text, email text)
  returns users
  language plpgsql volatile
  as $$ declare result users; begin ... return result; end; $$;
```

**Function design rules:**
- Always use **named arguments** (unnamed get `arg1`, `arg2` — ugly in GraphQL)
- `STABLE`/`IMMUTABLE` → Query field; `VOLATILE` → Mutation field
- Returning `SETOF table_name` → connection/list field
- Returning a single row type → single object field
- Prefer `LANGUAGE sql` for inlineability (PostgreSQL can optimize these)
- Computed columns: first arg must be `(row table_name)` by convention

### Enums

PostgreSQL enums → GraphQL enum types automatically:
```sql
create type user_role as enum ('admin', 'moderator', 'user');
-- GraphQL: enum UserRole { ADMIN MODERATOR USER }
```

### Relationships

PostGraphile infers relations from foreign keys:
```sql
-- Forward: post.author_id → users.id
-- Generates: Post.userByAuthorId (or Post.author with simplify)
-- Reverse:   User.forumPostsByAuthorId (or User.forumPosts with simplify)

alter table forum_posts
  add constraint forum_posts_author_id_fkey
  foreign key (author_id) references users(id);
```

For views (no actual FK): use `@foreignKey` smart tag:
```sql
comment on view post_summaries is E'@foreignKey (author_id) references users (id)';
```

## Polymorphism Patterns

### Single Table Inheritance
All types in one table with a discriminator column:
```sql
create type item_type as enum ('TOPIC', 'POST', 'COMMENT');
create table single_table_items (
  id serial primary key,
  type item_type not null,
  parent_id int references single_table_items(id),
  title text,    -- TOPIC only
  body text,     -- POST/COMMENT only
  ...
);
comment on table single_table_items is E'
  @interface mode:single type:type
  @type TOPIC name:Topic attributes:title
  @type POST name:Post attributes:body
  @type COMMENT name:Comment attributes:body
';
```

### Relational (Table Per Type)
Shared base table + child tables:
```sql
create table items (id serial primary key, type text not null);
create table topics (id int primary key references items(id), title text);
create table posts (id int primary key references items(id), body text);

comment on table items is E'
  @interface mode:relational type:type
  @type TOPIC references:topics
  @type POST references:posts
';
```

### Union Types
Independent unrelated tables:
```sql
comment on table videos is E'@unionMember SearchResult';
comment on table articles is E'@unionMember SearchResult';
```

**Polymorphism constraints:**
- Single table mode requires a primary key
- CRUD mutations are NOT generated for polymorphic types
- Use custom VOLATILE functions for mutations on polymorphic types
- Union mode cannot be returned from PostgreSQL functions

## Schema Design Best Practices for PostGraphile

**Use separate schemas** for access control:
- `public` / `app_public` — tables exposed via PostGraphile
- `app_private` — tables never exposed (passwords, secrets)
- `app_hidden` — accessible to PostGraphile but not public-facing

**Design for the GraphQL consumer:**
- Name tables and columns what you want in the API (or plan to use `@name`)
- Add `@graphile/simplify-inflection` from day one — removes `ByColumnName` suffixes
- Avoid generic column names like `data` or `metadata` — be specific
- Foreign keys should match their target (`author_id` → `users.id`, not `user_ref`)

**Functions over complex views for mutations:**
- Views don't auto-generate mutations reliably
- Use VOLATILE functions for any custom write operations
- Use STABLE functions for complex read operations needing parameters

**Connection vs List:**
- Connections (cursor pagination): better for large, unbounded datasets
- Lists: simpler; good for small bounded sets
- Default: connections. Override globally with `defaultBehavior: "-connection +list"`
- Or per-entity: `@behavior +list -connection`
