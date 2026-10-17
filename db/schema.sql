-- Forge: tasks + subtasks + habits schema.
--
-- Lives in its own `forge` schema on a Render Postgres instance shared with
-- other apps (each kept in its own schema) — never touch `public` or any
-- other schema from here. There's no RLS/policies here: the database has no
-- public access at all, it's only reachable from server.js (over Render's
-- internal network in production) via a single server-side credential, so
-- access control is "only our own API can see this" rather than row-level.

create schema if not exists forge;
create extension if not exists pgcrypto;

create table forge.tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'task' check (kind in ('task', 'goal')),
  title text not null,
  due_at timestamptz,
  -- False when only a date was picked (no specific time) — display omits the clock time.
  due_has_time boolean not null default true,
  recurrence_note text,
  -- Structured recurrence rule the engine reads to spawn the next occurrence on completion.
  -- recurrence_note stays the cached display text (built client-side); these drive the logic.
  repeat_type text not null default 'none'
    check (repeat_type in ('none', 'daily', 'weekly', 'weekdays', 'weekends', 'monthly', 'yearly', 'custom_days')),
  repeat_days text[],
  times_per_day integer not null default 1,
  -- How the series ends: never, after a fixed count, or on a cutoff date.
  repeat_end_type text not null default 'never' check (repeat_end_type in ('never', 'count', 'date')),
  repeat_end_date timestamptz,
  repeat_occurrences_left integer,
  reminder_count integer not null default 0,
  snooze_count integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table forge.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references forge.tasks(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0
);

-- One row per snooze action, so the "откладывания по часам" chart
-- and future stats can be computed from real history.
create table forge.snooze_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references forge.tasks(id) on delete cascade,
  occurred_at timestamptz not null default now()
);

-- Habits: a persistent recurring practice tracked by day, not a task that
-- gets completed-and-respawned. One row per habit; completions are a
-- separate per-day log so streaks/history are computed from real data.
create table forge.habits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text, -- a single emoji, shown instead of a photo avatar
  color text not null default '#1B8A78',
  -- Which days of the week this habit is due — empty/null means every day.
  target_days text[],
  times_per_day integer not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table forge.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references forge.habits(id) on delete cascade,
  date date not null,
  count integer not null default 0,
  unique (habit_id, date)
);
