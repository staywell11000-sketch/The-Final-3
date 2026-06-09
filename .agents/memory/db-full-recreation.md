---
name: DB full recreation pattern
description: How to fully recreate the Replit PG database when it resets, since drizzle-kit push requires a TTY.
---

# DB Full Recreation Pattern

## Problem
Replit PG databases reset on environment restarts. `drizzle-kit push` fails in non-interactive shells with "Interactive prompts require a TTY terminal". The `yes |` pipe trick doesn't work because drizzle-kit checks `process.stdin.isTTY`.

## Solution
Use the `pg` module directly to run raw SQL CREATE TABLE statements.

```bash
node -e "
const pg = require('/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// ... run SQL
"
```

## Required Steps
1. First DROP all tables: `DROP TABLE IF EXISTS t1, t2, t3 CASCADE` — include ALL tables in one statement, CASCADE handles FKs
2. Recreate in dependency order: tables with no FK deps first (users, organizations), then tables that reference them
3. DO NOT include FK constraints in CREATE TABLE; they can cause circular dependency issues across sessions
4. For WA tables: whatsapp_accounts must be created before user_whatsapp_permissions and conversation_wa_accounts (they have REFERENCES whatsapp_accounts(id))

## Key columns that differ from naive schema
- `leads`: has 25+ columns including arrays (TEXT[], JSONB), NOT the simplified version
- `organizations`: has `is_internal BOOLEAN`, `trial_end_date`, `support_access_enabled`, etc.
- `users`: has `is_suspended`, `invited_by`, `preferred_language`
- `notifications`: has `read BOOLEAN`, `action_url`, `metadata JSONB`, `read_at`, `updated_at`
- `support_tickets`: needs `organization_id INTEGER`
- `invitations`: needs `org_role VARCHAR(50)` (separate from `role`)

**Why:** The Drizzle schema files in lib/db/src/schema/ define the authoritative column list. Always reference those files when recreating tables from scratch — do not rely on simplified guesses.

**How to apply:** When `requireAuth` returns 500 with "relation X does not exist" or "column Y does not exist", run the full recreation script. Check each error against the Drizzle schema file for that table.
