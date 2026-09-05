import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DAY_MS, localDateKey, computeStreaks } from '../lib/streaks';

const WINDOW_DAYS = 90;
const CHART_DAYS = 30;

export function useProgress() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since90 = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();

    const [completedRes, snoozeRes] = await Promise.all([
      supabase.from('tasks').select('completed_at, due_at, snooze_count').eq('completed', true),
      supabase.from('snooze_events').select('occurred_at').gte('occurred_at', since90),
    ]);

    if (completedRes.error) {
      setStats(null);
      setLoading(false);
      return;
    }

    const completed = completedRes.data;
    const { current, record } = computeStreaks(completed.map((t) => localDateKey(t.completed_at)));

    const recent90 = completed.filter((t) => t.completed_at >= since90);
    const withDue = recent90.filter((t) => t.due_at);
    const onTimeRate = withDue.length
      ? Math.round((withDue.filter((t) => t.completed_at <= t.due_at).length / withDue.length) * 100)
      : null;
    const avgSnoozes = recent90.length
      ? recent90.reduce((sum, t) => sum + t.snooze_count, 0) / recent90.length
      : null;

    // How many tasks were completed on each of the last CHART_DAYS days
    // (index 0 = oldest, last index = today).
    const dailyCounts = new Array(CHART_DAYS).fill(0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    completed.forEach((t) => {
      const d = new Date(t.completed_at);
      d.setHours(0, 0, 0, 0);
      const daysAgo = Math.round((todayStart - d) / DAY_MS);
      if (daysAgo >= 0 && daysAgo < CHART_DAYS) {
        dailyCounts[CHART_DAYS - 1 - daysAgo] += 1;
      }
    });

    const hourBuckets = new Array(24).fill(0);
    (snoozeRes.data ?? []).forEach((s) => {
      hourBuckets[new Date(s.occurred_at).getHours()] += 1;
    });

    setStats({
      totalCompleted: completed.length,
      streak: current,
      streakRecord: record,
      onTimeRate90: onTimeRate,
      avgSnoozes90: avgSnoozes,
      dailyCounts,
      hourBuckets,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading };
}
