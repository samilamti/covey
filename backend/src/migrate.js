/**
 * Database migration runner.
 *
 * All tables are created in a single initial migration (001_initial).
 * This is safe because there is no production data yet — we can rewrite
 * history freely. Future schema changes (post-launch) will use incremental
 * migrations appended to this array.
 *
 * Run manually:  node src/migrate.js
 * Called from index.js on server startup to guarantee tables exist.
 */

import pg from 'pg'

const { Client } = pg

const migrations = [
  {
    name: '001_initial',
    sql: `
      -- Track executed migrations
      CREATE TABLE IF NOT EXISTS migrations (
        id     SERIAL PRIMARY KEY,
        name   TEXT UNIQUE NOT NULL,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Users (BankID-verified)
      CREATE TABLE IF NOT EXISTS users (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nin_hash             TEXT UNIQUE NOT NULL,
        display_name         TEXT NOT NULL DEFAULT '',
        given_name           TEXT NOT NULL DEFAULT '',
        surname              TEXT NOT NULL DEFAULT '',
        birth_year           INTEGER,
        sex                  CHAR(1) CHECK (sex IN ('M', 'F')),
        verified             BOOLEAN NOT NULL DEFAULT FALSE,
        preferred_lang       TEXT NOT NULL DEFAULT 'sv',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at        TIMESTAMPTZ,
        deleted_at           TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_users_nin_hash
        ON users(nin_hash) WHERE deleted_at IS NULL;

      -- Assistance requests (the core feature)
      CREATE TABLE IF NOT EXISTS assistance_requests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type            TEXT NOT NULL DEFAULT 'walk'
                          CHECK (type IN ('walk', 'wait')),
        message         TEXT NOT NULL DEFAULT '',
        eligibility_tier TEXT NOT NULL DEFAULT 'same_demographics'
                          CHECK (eligibility_tier IN (
                            'same_demographics', 'verified_guardians', 'any_member'
                          )),
        status          TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN (
                            'open', 'accepted', 'active', 'done_pending',
                            'completed', 'safety_confirmed',
                            'cancelled', 'expired'
                          )),
        requester_id    UUID REFERENCES users(id),
        pickup_lat      NUMERIC(10, 7),
        pickup_lng      NUMERIC(10, 7),
        destination_lat NUMERIC(10, 7),
        destination_lng NUMERIC(10, 7),
        helper_id       UUID REFERENCES users(id),
        accepted_at     TIMESTAMPTZ,
        expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
        completed_at    TIMESTAMPTZ,
        cancelled_at    TIMESTAMPTZ,
        done_initiated_by UUID REFERENCES users(id),
        done_initiated_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_req_expires
        ON assistance_requests(expires_at)
        WHERE status IN ('open', 'accepted', 'active', 'done_pending');
      CREATE INDEX IF NOT EXISTS idx_req_open
        ON assistance_requests(status, created_at DESC)
        WHERE status IN ('open', 'accepted', 'active');

      -- Ephemeral location data during active sessions (GDPR-sensitive)
      CREATE TABLE IF NOT EXISTS location_updates (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id  UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id),
        latitude    NUMERIC(10, 7) NOT NULL,
        longitude   NUMERIC(10, 7) NOT NULL,
        accuracy_m  REAL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_loc_request
        ON location_updates(request_id, recorded_at DESC);

      -- Auto-cleanup: purge location data when request reaches terminal state
      CREATE OR REPLACE FUNCTION cleanup_location_data()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status IN ('completed', 'cancelled', 'expired') AND
           OLD.status NOT IN ('completed', 'cancelled', 'expired') THEN
          DELETE FROM location_updates WHERE request_id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_cleanup_locations ON assistance_requests;
      CREATE TRIGGER trg_cleanup_locations
        AFTER UPDATE ON assistance_requests
        FOR EACH ROW EXECUTE FUNCTION cleanup_location_data();

      -- Post-session safety ratings
      CREATE TABLE IF NOT EXISTS ratings (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id  UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
        rater_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rated_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value       INTEGER NOT NULL CHECK (value IN (-3, 0, 1)),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(request_id, rater_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ratings_rated
        ON ratings(rated_id);

      -- Web Push API subscriptions
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, endpoint)
      );
      CREATE INDEX IF NOT EXISTS idx_push_user
        ON push_subscriptions(user_id);
    `,
  },
  {
    name: '002_ratings_and_demographics',
    sql: `
      -- Add demographic columns to users (extracted from NIN during auth).
      -- ALTER TABLE ADD COLUMN IF NOT EXISTS is idempotent — safe on fresh and old DBs.
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sex CHAR(1);

      -- Add eligibility tier to assistance requests
      ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS
        eligibility_tier TEXT NOT NULL DEFAULT 'same_demographics';

      -- Post-session safety ratings (idempotent via CREATE TABLE IF NOT EXISTS)
      CREATE TABLE IF NOT EXISTS ratings (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id  UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
        rater_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rated_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value       INTEGER NOT NULL CHECK (value IN (-3, 0, 1)),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(request_id, rater_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ratings_rated
        ON ratings(rated_id);
    `,
  },
  {
    name: '003_session_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS session_messages (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id  UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
        sender_id   UUID NOT NULL REFERENCES users(id),
        content     TEXT NOT NULL,
        is_quick    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_msg_request
        ON session_messages(request_id, created_at);
    `,
  },
  {
    name: '004_done_pending',
    sql: `
      -- Add done_pending status and mutual-done columns (for existing dev DBs)
      ALTER TABLE assistance_requests DROP CONSTRAINT IF EXISTS assistance_requests_status_check;
      ALTER TABLE assistance_requests ADD CONSTRAINT assistance_requests_status_check
        CHECK (status IN (
          'open', 'accepted', 'active', 'done_pending',
          'completed', 'safety_confirmed',
          'cancelled', 'expired'
        ));
      ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS done_initiated_by UUID REFERENCES users(id);
      ALTER TABLE assistance_requests ADD COLUMN IF NOT EXISTS done_initiated_at TIMESTAMPTZ;
    `,
  },
  {
    name: '005_nullable_requester',
    sql: `
      -- Allow requester_id to be NULL for GDPR anonymization of deleted users.
      -- DROP NOT NULL is idempotent if the column is already nullable.
      ALTER TABLE assistance_requests ALTER COLUMN requester_id DROP NOT NULL;
    `,
  },
  {
    name: '006_wait_type',
    sql: `
      -- Allow 'wait' type in addition to 'walk' (for existing dev/prod DBs)
      ALTER TABLE assistance_requests DROP CONSTRAINT IF EXISTS assistance_requests_type_check;
      ALTER TABLE assistance_requests ADD CONSTRAINT assistance_requests_type_check
        CHECK (type IN ('walk', 'wait'));
    `,
  },
  {
    name: '007_expiry_2h',
    sql: `
      -- Extend request expiration from 30 minutes to 2 hours and cover all
      -- non-terminal statuses (open, accepted, active, done_pending).
      ALTER TABLE assistance_requests
        ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '2 hours');
      DROP INDEX IF EXISTS idx_req_expires;
      CREATE INDEX idx_req_expires
        ON assistance_requests(expires_at)
        WHERE status IN ('open', 'accepted', 'active', 'done_pending');
    `,
  },
  {
    name: '008_points_system',
    sql: `
      -- Points ledger: one entry per user per completed session
      CREATE TABLE IF NOT EXISTS points_ledger (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_id  UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK (role IN ('helper', 'requester')),
        points      INTEGER NOT NULL,
        reason      TEXT NOT NULL DEFAULT 'session_completed',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, request_id)
      );
      CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id);

      -- Badges: private by default, opt-in visibility
      CREATE TABLE IF NOT EXISTS badges (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_key   TEXT NOT NULL,
        earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        visible     BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE(user_id, badge_key)
      );
      CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);

      -- Anti-gaming: pair cooldown (canonical ordering: smaller UUID = user_a)
      CREATE TABLE IF NOT EXISTS pair_cooldowns (
        user_a            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_a, user_b)
      );
    `,
  },
]

/**
 * Run all pending migrations.
 * Safe to call multiple times — already-applied migrations are skipped.
 * Uses CREATE TABLE IF NOT EXISTS so even "skipped" migrations won't
 * leave the DB in a broken state if tables were dropped externally.
 */
export async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Ensure migrations table exists (idempotent bootstrap)
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id     SERIAL PRIMARY KEY,
      name   TEXT UNIQUE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  for (const migration of migrations) {
    const { rows } = await client.query(
      'SELECT id FROM migrations WHERE name = $1',
      [migration.name]
    )
    if (rows.length > 0) {
      // Even if "already run", re-execute the SQL since it's all IF NOT EXISTS.
      // This handles the case where migration was recorded but tables were dropped.
      await client.query(migration.sql)
      console.log(`  verify  ${migration.name}`)
      continue
    }
    await client.query(migration.sql)
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name])
    console.log(`  ran   ${migration.name}`)
  }

  await client.end()
  console.log('Migrations complete.')
}

// Allow standalone execution: node src/migrate.js
// When imported by index.js, this block does NOT run (no top-level await side-effect).
const isMain = process.argv[1]?.endsWith('migrate.js')
if (isMain) {
  migrate().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}
