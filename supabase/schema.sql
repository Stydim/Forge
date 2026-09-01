-- Forge: tasks + subtasks schema
create extension if not exists pgcrypto;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'task' check (kind in ('task', 'goal')),
  title text not null,
  due_at timestamptz,
  recurrence_note text,
  reminder_count integer not null default 0,
  snooze_count integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0
);

alter table tasks enable row level security;
alter table subtasks enable row level security;

-- No auth yet: allow the anon (publishable) key full access.
-- Tighten this once per-user auth is added.
create policy "anon full access" on tasks for all using (true) with check (true);
create policy "anon full access" on subtasks for all using (true) with check (true);

-- Seed with the same three example tasks currently shown as mock data.
insert into tasks (kind, title, due_at, recurrence_note, reminder_count, snooze_count)
values
  ('task', 'Витамины', now() - interval '40 minutes', null, 5, 4),
  ('task', 'Показания счётчика', date_trunc('day', now()) + interval '20 hours', 'ежемесячно 19-го', 0, 0);

insert into tasks (kind, title, due_at)
values ('goal', 'Запустить лендинг', now() + interval '8 days');

with goal as (
  select id from tasks where title = 'Запустить лендинг' order by created_at desc limit 1
)
insert into subtasks (task_id, label, done, position)
select goal.id, v.label, v.done, v.position
from goal, (values
  ('Собрать структуру', true, 0),
  ('Написать тексты', true, 1),
  ('Свести на мобильном', false, 2)
) as v(label, done, position);
