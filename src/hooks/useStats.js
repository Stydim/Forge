import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DAY_MS = 86400000;

function localDateKey(iso) {
  return new Date(iso).toLocaleDateString('en-CA');
}

function computeStreaks(dateKeys) {
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

export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const [completedRes, snoozeRes] = await Promise.all([
      supabase.from('tasks').select('completed_at, due_at, snooze_count').eq('completed', true),
      supabase.from('snooze_events').select('occurred_at').gte('occurred_at', since),
    ]);

    if (completedRes.error) {
      setStats(null);
      setLoading(false);
      return;
    }

    const completed = completedRes.data;
    const { current, record } = computeStreaks(completed.map((t) => localDateKey(t.completed_at)));

    const recent = completed.filter((t) => t.completed_at >= since);
    const withDue = recent.filter((t) => t.due_at);
    const onTimeRate = withDue.length
      ? Math.round((withDue.filter((t) => t.completed_at <= t.due_at).length / withDue.length) * 100)
      : null;

    const avgSnoozes = recent.length
      ? recent.reduce((sum, t) => sum + t.snooze_count, 0) / recent.length
      : null;

    const hourBuckets = new Array(24).fill(0);
    (snoozeRes.data ?? []).forEach((s) => {
      hourBuckets[new Date(s.occurred_at).getHours()] += 1;
    });

    setStats({ streak: current, streakRecord: record, onTimeRate, avgSnoozes, hourBuckets });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, reload: load };
}
