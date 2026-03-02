---
name: db
description: Run quick database queries against the local PostgreSQL container. Use when inspecting users, requests, schema, or running ad-hoc SQL.
argument-hint: "[users|requests|schema|clear|query <SQL>]"
---

Run quick database operations. Parse `$ARGUMENTS` for the subcommand. Default to `users` if blank.

All SQL runs via docker exec. On Windows/Git Bash, **always** prefix with `MSYS_NO_PATHCONV=1` to prevent path mangling.

First, read the DB credentials from the container's environment:
```bash
MSYS_NO_PATHCONV=1 docker exec tillsammans-db-1 env | grep POSTGRES_
```
This gives you `POSTGRES_USER` and `POSTGRES_DB`. Then use them:
```bash
MSYS_NO_PATHCONV=1 docker exec tillsammans-db-1 psql -U $POSTGRES_USER -d $POSTGRES_DB -c "<SQL>"
```

Or use the container's env vars inline:
```bash
MSYS_NO_PATHCONV=1 docker exec tillsammans-db-1 bash -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "<SQL>"'
```

The container name is `tillsammans-db-1`. Credentials come from `.env.local` (not hardcoded).

### Subcommands

**`users`** — List all users:
```sql
SELECT id, display_name, birth_year, sex, created_at FROM users ORDER BY created_at DESC;
```

**`requests`** — List open assistance requests:
```sql
SELECT r.id, r.status, r.eligibility_tier, r.community_id, r.requester_id, u.display_name as requester_name, r.created_at
FROM assistance_requests r
JOIN users u ON r.requester_id = u.id
WHERE r.status IN ('open', 'accepted', 'active')
ORDER BY r.created_at DESC;
```

**`schema`** — Show all tables and columns:
```sql
SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
```

**`clear`** — Truncate all data tables (keep schema). **Warn the user first** and ask for confirmation:
```sql
TRUNCATE session_messages, assistance_requests, community_members, communities, push_subscriptions, ratings, users CASCADE;
```

**`query <SQL>`** — Run the provided SQL directly.

## Notes
- All `id` columns are UUID type — don't pass non-UUID strings
- `MSYS_NO_PATHCONV=1` is critical on Windows (Git Bash converts `/app/...` paths otherwise)
- The migration table is `_migrations` — don't truncate it
