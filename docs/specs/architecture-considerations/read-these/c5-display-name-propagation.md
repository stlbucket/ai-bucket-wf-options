# C5 — `display_name` Propagation Trigger Pattern

Each module maintains a shadow `<module>_resident` table with a denormalized `display_name`
column. When `app.profile.display_name` is updated, per-module triggers propagate the change.

## The Trigger Pattern (per module)

```sql
-- In each module's _fn deploy file:
CREATE OR REPLACE TRIGGER <module>_on_app_profile_updated
  AFTER UPDATE ON app.profile
  FOR EACH ROW
  WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name)
  EXECUTE PROCEDURE <module>_fn.handle_update_profile();

-- The function:
CREATE OR REPLACE FUNCTION <module>_fn.handle_update_profile()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE <module>.<module>_resident
  SET display_name = NEW.display_name
  WHERE resident_id IN (
    SELECT id FROM app.resident WHERE profile_id = NEW.id
  );
  RETURN NEW;
END; $$;
```

## Existing Implementations

| Module | Trigger Name | Function |
|--------|-------------|----------|
| msg | `msg_on_app_profile_updated` | `msg_fn.handle_update_profile()` |
| todo | `todo_on_app_profile_updated` | `todo_fn.handle_update_profile()` |
| loc | `loc_on_app_profile_updated` | `loc_fn.handle_update_profile()` |

## Why Denormalized

Queries on module data (e.g., listing messages with sender names) would require joining
through multiple tables to get display_name. Denormalizing into the shadow table allows
simple, RLS-safe queries within the module schema without cross-schema joins.

## Required When Adding a New Module

Any new module with a shadow `<module>_resident` table that stores `display_name` MUST
add this trigger in its `<module>_fn` deploy file. Omitting it means display names in that
module go stale when users update their profile — a silent data inconsistency bug.

The deploy order: `<module>_fn` deploy file → create the trigger on `app.profile`.
The `<module>_fn` schema must have SELECT on `app.profile` (granted in the policies file).
