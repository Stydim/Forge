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

-- Reader: bilingual RU<->EN book reading with on-demand Grok translation
-- (cached per paragraph) and AI word glosses (cached per word+language pair).
create table forge.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  source_lang text not null check (source_lang in ('ru', 'en')),
  target_lang text not null check (target_lang in ('ru', 'en')),
  format text not null check (format in ('txt', 'epub', 'fb2')),
  spine_color text not null default '#5CC8E0',
  paragraph_count integer not null default 0,
  -- Last-read position (paragraph index) — doubles as the resume point and
  -- the progress-bar numerator.
  current_paragraph integer not null default 0,
  -- Place on the library's bookshelf photo (index into SHELF_SLOTS in
  -- src/lib/bookshelf.js); null = not placed yet.
  shelf_slot integer,
  -- A book just for reading in Читалка: opened without translation.
  plain_only boolean not null default false,
  created_at timestamptz not null default now()
);

create table forge.book_paragraphs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references forge.books(id) on delete cascade,
  position integer not null,
  text text not null,
  translation text,
  translated_at timestamptz,
  unique (book_id, position)
);

-- Dictionary cache: AI word lookups are reusable across books, so cache by
-- the exact tapped surface form + language pair rather than per-book.
create table forge.word_glosses (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  source_lang text not null check (source_lang in ('ru', 'en')),
  target_lang text not null check (target_lang in ('ru', 'en')),
  base_form text not null,
  part_of_speech text,
  translation text not null,
  example_source text,
  example_translation text,
  created_at timestamptz not null default now(),
  unique (word, source_lang, target_lang)
);

-- The user's personal deck. familiarity doubles as the Leitner box index
-- (0..5) driving both the familiarity bars and the SRS review interval.
create table forge.saved_words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  base_form text not null,
  source_lang text not null check (source_lang in ('ru', 'en')),
  translation text not null,
  part_of_speech text,
  example_source text,
  example_translation text,
  book_id uuid references forge.books(id) on delete set null,
  familiarity integer not null default 0 check (familiarity between 0 and 5),
  review_count integer not null default 0,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ElevenLabs text-to-speech cache: key = sha256(voice, model, text).
create table forge.tts_cache (
  key text primary key,
  audio bytea not null,
  created_at timestamptz not null default now()
);

-- Quotes saved from books (or pasted by hand), shown in the picture frame on
-- the library's bookshelf photo: the pinned one, which a new quote becomes.
-- book_title is a snapshot so the attribution survives deleting the book.
create table forge.quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text,
  book_id uuid references forge.books(id) on delete set null,
  book_title text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Plain reading mode: coloured highlights of the original text (paragraph +
-- char offset at each end, end exclusive) with optional notes, and bookmarks.
create table forge.highlights (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references forge.books(id) on delete cascade,
  start_para integer not null,
  start_offset integer not null,
  end_para integer not null,
  end_offset integer not null,
  text text not null,
  color text,
  note text,
  created_at timestamptz not null default now()
);

create table forge.bookmarks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references forge.books(id) on delete cascade,
  paragraph integer not null,
  snippet text,
  created_at timestamptz not null default now(),
  unique (book_id, paragraph)
);
