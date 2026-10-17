// One-off migration: Supabase (REST, anon key) -> Render Postgres (forge schema).
// Run once from the Forge project dir: node scripts/migrate-to-render.mjs
// Safe to re-run: schema/table creation is idempotent, and row inserts use
// the original ids, so a second run would just hit primary-key conflicts
// (which we treat as "already migrated" and skip) rather than duplicate.
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = 'https://bjksuldyyrwxddbvvfrl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dmHMX3U2xmMLlVn5kE4OAQ_8G_g0xNG';
const RENDER_URL = process.env.RENDER_DB_URL;

if (!RENDER_URL) {
  console.error('Set RENDER_DB_URL env var to the Render external database URL first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const client = new pg.Client({ connectionString: RENDER_URL, ssl: { rejectUnauthorized: false } });

const SCHEMA_SQL = `
create schema if not exists forge;
create extension if not exists pgcrypto;

create table if not exists forge.tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'task' check (kind in ('task', 'goal')),
  title text not null,
  due_at timestamptz,
  due_has_time boolean not null default true,
  recurrence_note text,
  repeat_type text not null default 'none'
    check (repeat_type in ('none', 'daily', 'weekly', 'weekdays', 'weekends', 'monthly', 'yearly', 'custom_days')),
  repeat_days text[],
  times_per_day integer not null default 1,
  repeat_end_type text not null default 'never' check (repeat_end_type in ('never', 'count', 'date')),
  repeat_end_date timestamptz,
  repeat_occurrences_left integer,
  reminder_count integer not null default 0,
  snooze_count integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists forge.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references forge.tasks(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0
);

create table if not exists forge.snooze_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references forge.tasks(id) on delete cascade,
  occurred_at timestamptz not null default now()
);

create table if not exists forge.habits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text,
  color text not null default '#1B8A78',
  target_days text[],
  times_per_day integer not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists forge.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references forge.habits(id) on delete cascade,
  date date not null,
  count integer not null default 0,
  unique (habit_id, date)
);
`;

// Order matters: parents before children (FK references).
const TABLES = ['tasks', 'habits', 'subtasks', 'snooze_events', 'habit_completions'];

async function fetchAll(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`Supabase fetch ${table}: ${error.message}`);
  return data;
}

async function insertRows(table, rows) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const values = cols.map((c) => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    try {
      await client.query(
        `insert into forge.${table} (${colList}) values (${placeholders}) on conflict (id) do nothing`,
        values
      );
      inserted += 1;
    } catch (err) {
      console.error(`  ! failed row ${row.id} in ${table}: ${err.message}`);
      skipped += 1;
    }
  }
  return { inserted, skipped };
}

async function main() {
  await client.connect();
  console.log('Connected to Render Postgres.');

  await client.query(SCHEMA_SQL);
  console.log('Schema + tables ensured in forge.*');

  for (const table of TABLES) {
    const rows = await fetchAll(table);
    console.log(`Supabase ${table}: ${rows.length} rows`);
    const { inserted, skipped } = await insertRows(table, rows);
    console.log(`  -> inserted ${inserted}, skipped ${skipped}`);
  }

  console.log('\nVerifying counts in forge.*:');
  for (const table of TABLES) {
    const res = await client.query(`select count(*) from forge.${table}`);
    console.log(`  forge.${table}: ${res.rows[0].count}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
