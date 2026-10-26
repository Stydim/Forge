import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';
import { DAY_MS, localDateKey, computeStreaks, averageSnoozes } from '../lib/streaks';

export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

    let completed, snoozeEvents, openTasks;
    try {
      [completed, snoozeEvents, openTasks] = await Promise.all([
        api.listCompletedTaskStats(),
        api.listSnoozeEventsSince(since),
        api.listOpenTasks(),
      ]);
    } catch {
      setStats(null);
      setLoading(false);
      return;
    }

    const { current, record } = computeStreaks(completed.map((t) => localDateKey(t.completed_at)));

    const recent = completed.filter((t) => t.completed_at >= since);
    const withDue = recent.filter((t) => t.due_at);
    const onTimeRate = withDue.length
      ? Math.round((withDue.filter((t) => t.completed_at <= t.due_at).length / withDue.length) * 100)
      : null;

    const avgSnoozes = averageSnoozes(recent, openTasks);

    const hourBuckets = new Array(24).fill(0);
    (snoozeEvents ?? []).forEach((s) => {
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
