export const DAY_MS = 86400000;

export function localDateKey(iso) {
  return new Date(iso).toLocaleDateString('en-CA');
}

export function computeStreaks(dateKeys) {
  const set = new Set(dateKeys);
  const todayKey = localDateKey(new Date().toISOString());

  let cursor = set.has(todayKey) ? new Date() : new Date(Date.now() - DAY_MS);
  let current = 0;
  while (set.has(cursor.toLocaleDateString('en-CA'))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  const sorted = [...set].sort();
  let record = 0;
  let run = 0;
  let prevDate = null;
  for (const key of sorted) {
    const date = new Date(key);
    run = prevDate && Math.round((date - prevDate) / DAY_MS) === 1 ? run + 1 : 1;
    record = Math.max(record, run);
    prevDate = date;
  }

  return { current, record: Math.max(record, current) };
}

// Average snoozes per task over a period: the tasks completed in it plus the
// ones still open. Open tasks are where snoozes actually pile up — counting
// only completed ones showed "0,0" while an open task sat snoozed on screen.
export function averageSnoozes(completedInPeriod, openTasks) {
  const tasks = [...completedInPeriod, ...(openTasks ?? [])];
  if (!tasks.length) return null;
  return tasks.reduce((sum, t) => sum + (t.snooze_count || 0), 0) / tasks.length;
}
