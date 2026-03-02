---
name: add-migration
description: Append a new database migration to migrate.js. Use when adding tables, columns, or indexes to the schema.
argument-hint: "<migration_name>"
---

Add a new migration entry to `backend/src/migrate.js`. Parse `$ARGUMENTS` for the migration name (e.g. `add_reports_table`).

### Step 1 — Determine the next migration number

Read `backend/src/migrate.js` and find the highest existing migration number. The new migration should be `00N_<name>` where N is the next number.

### Step 2 — Append to the migrations array

Add a new entry at the end of the `migrations` array:

```js
{
  name: '00N_<migration_name>',
  sql: `
    -- Description of what this migration does
    <DDL statements here>
  `,
},
```

### DDL conventions (MUST follow all of these)

**Idempotency** — every statement must be re-runnable:
- Tables: `CREATE TABLE IF NOT EXISTS`
- Columns: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Indexes: `CREATE INDEX IF NOT EXISTS`

**Column types**:
- Primary keys: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Foreign keys: `UUID REFERENCES <table>(id) ON DELETE CASCADE`
- Timestamps: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Soft delete: `deleted_at TIMESTAMPTZ` (nullable, null = active)
- Text: `TEXT NOT NULL DEFAULT ''` (prefer non-null with default)
- Boolean: `BOOLEAN NOT NULL DEFAULT FALSE`

**Naming**:
- Table names: `snake_case`, plural (e.g. `session_messages`, `push_subscriptions`)
- Column names: `snake_case` (e.g. `requester_id`, `created_at`)
- Index names: `idx_<table>_<column>` (e.g. `idx_ratings_rater_id`)

### Step 3 — Handle existing dev databases

If this is a new table (`CREATE TABLE IF NOT EXISTS`), no action needed — it auto-creates.

If this is an `ALTER TABLE` on an existing table:
- `ADD COLUMN IF NOT EXISTS` — safe, no action needed
- Changing column types, dropping columns, or adding constraints on existing columns — tell the user they need to run `/stack reset` to recreate the DB from scratch

### Example

```js
{
  name: '004_add_reports',
  sql: `
    CREATE TABLE IF NOT EXISTS reports (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  `,
},
```

## Notes
- Migrations run automatically on server startup (`index.js` calls `migrate()` before `listen()`)
- Pre-launch: `001_initial` can still be edited freely since there's no production data
- Post-launch: always use incremental migrations (never modify already-applied ones)
- The migration runner tracks which migrations have run in the `migrations` table
