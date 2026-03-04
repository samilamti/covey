---
name: add-repository
description: Scaffold a backend repository module for database access. Use when adding a new data model or table interactions.
argument-hint: "<resource-name>"
---

Scaffold a backend repository file. Parse `$ARGUMENTS` for the resource name in singular form (e.g. `report`, `notification`).

### Create `backend/src/repositories/<name>.js`

Follow this exact pattern (matches existing repositories like `messages.js`, `ratings.js`, `users.js`):

```js
/**
 * <Name> repository.
 */

import { db } from '../pool.js'

/**
 * Create a new <name>.
 */
export async function create({ field1, field2 }) {
  const { rows } = await db.query(`
    INSERT INTO <table_name> (field1, field2)
    VALUES ($1, $2)
    RETURNING *
  `, [field1, field2])
  return rows[0]
}

/**
 * Find a <name> by ID.
 */
export async function findById(id) {
  const { rows } = await db.query(
    'SELECT * FROM <table_name> WHERE id = $1',
    [id]
  )
  return rows[0] || null
}

/**
 * Find all <names> for a user.
 */
export async function findByUser(userId) {
  const { rows } = await db.query(`
    SELECT * FROM <table_name>
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId])
  return rows
}

/**
 * Delete a <name>.
 */
export async function remove(id) {
  const { rows } = await db.query(
    'DELETE FROM <table_name> WHERE id = $1 RETURNING *',
    [id]
  )
  return rows[0] || null
}
```

### SQL patterns

**Parameterized queries only** — never interpolate user input into SQL strings:
```js
// CORRECT
db.query('SELECT * FROM users WHERE id = $1', [userId])

// WRONG — SQL injection risk
db.query(`SELECT * FROM users WHERE id = '${userId}'`)
```

**Upsert** (insert or update on conflict):
```js
const { rows } = await db.query(`
  INSERT INTO <table> (unique_field, value)
  VALUES ($1, $2)
  ON CONFLICT (unique_field)
  DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  RETURNING *
`, [uniqueField, value])
```

**Aggregate with COALESCE** (avoid null in sums):
```js
const { rows } = await db.query(
  'SELECT COALESCE(SUM(value), 0)::int AS total FROM <table> WHERE user_id = $1',
  [userId]
)
return rows[0].total
```

**Subquery exclusion** (e.g. "not yet rated"):
```js
const { rows } = await db.query(`
  SELECT * FROM <table> t
  WHERE t.user_id = $1
    AND NOT EXISTS (
      SELECT 1 FROM <other_table> o
      WHERE o.ref_id = t.id AND o.actor_id = $1
    )
  ORDER BY t.created_at DESC
  LIMIT 10
`, [userId])
```

**Eligibility-filtered queries** (for request listing or push targeting):
```js
// Three-tier eligibility in SQL WHERE clause
WHERE (
  (ar.eligibility_tier = 'any_member')
  OR (ar.eligibility_tier = 'same_demographics'
      AND u.sex = $2 AND ABS(u.birth_year - $3) <= 5)
  OR (ar.eligibility_tier = 'verified_guardians'
      AND ((u.sex = $2 AND ABS(u.birth_year - $3) <= 5)
           OR /* safety score check */))
)
```

### Conventions

- **File location**: `backend/src/repositories/<name>.js`
- **Import**: Always `import { db } from '../pool.js'` — the shared connection pool
- **Exports**: Named exports (`export async function findById`), not a class or default export
- **Module system**: ES modules (`import`/`export`), NOT CommonJS
- **Return values**: Single row → `rows[0] || null`. Multiple rows → `rows`. Counts → `rows[0].count`.
- **SQL aliases**: When JOINing, use `AS` aliases to match what the JS consumer expects. E.g., `u.id AS user_id` if the frontend reads `user_id`
- **Column naming**: SQL uses `snake_case` (`created_at`, `user_id`). JS reads them as-is from `rows[0]` — no camelCase conversion
- **RETURNING \***: Always use `RETURNING *` on INSERT/UPDATE/DELETE to get the modified row back without a second query
- **LIMIT**: Always include a `LIMIT` on `SELECT` queries that return lists — prevent unbounded result sets
- **No ORM**: Raw SQL with `db.query()` — no Knex, Sequelize, or Prisma

### After creating the repository

1. **Ensure the table exists**: If the table is new, use `/add-migration` to add the DDL
2. **Import in routes or handlers**: `import * as <name>Repo from '../repositories/<name>.js'`
3. **Verify column names**: Run `/db` with `SELECT column_name FROM information_schema.columns WHERE table_name = '<table>'` to check actual schema
4. **Run `/check-exports`**: Ensure the route/handler imports match the repository's exports exactly
5. **Add to GDPR**: If the table holds user data, add a `findByUser()` method for GDPR export and ensure the GDPR cleanup worker handles it
