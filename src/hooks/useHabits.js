import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

function mapRow(row) {
  const completions = {};
  for (const c of row.habit_completions ?? []) completions[c.date] = c.count;
  const { habit_completions, ...rest } = row;
  return { ...rest, completions };
}

export function useHabits() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listHabits();
      setError(null);
      setHabits(data.map(mapRow));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addHabit = useCallback(async ({ title, icon, color, targetDays, timesPerDay = 1 }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const data = await api.createHabit({
        title: trimmed,
        icon: icon?.trim() || null,
        color,
        target_days: targetDays && targetDays.length ? targetDays : null,
        times_per_day: timesPerDay,
      });
      setHabits((prev) => [...prev, mapRow(data)]);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const updateHabit = useCallback(async (id, { title, icon, color, targetDays, timesPerDay = 1 }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const fields = {
      title: trimmed,
      icon: icon?.trim() || null,
      color,
      target_days: targetDays && targetDays.length ? targetDays : null,
      times_per_day: timesPerDay,
    };
    try {
      await api.updateHabit(id, fields);
      setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...fields } : h)));
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  // Archive rather than hard-delete, same spirit as tasks going to the
  // archive on completion — keeps the completion history intact.
  const deleteHabit = useCallback(async (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    try {
      await api.updateHabit(id, { archived: true });
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  // Sets the exact completion count for one habit on one day.
  const setHabitCount = useCallback(async (habitId, dateKey, count) => {
    setHabits((prev) => prev.map((h) => (
      h.id === habitId ? { ...h, completions: { ...h.completions, [dateKey]: count } } : h
    )));
    try {
      await api.upsertHabitCompletion(habitId, dateKey, count);
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  // A single check-in tap: +1 each time, wrapping back to 0 once fully done
  // (same cycle Sanctuary's habit tracker uses) — not a per-chip direct-set.
  const toggleHabitDay = useCallback((habitId, dateKey) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const current = habit.completions[dateKey] || 0;
    const next = current < habit.times_per_day ? current + 1 : 0;
    return setHabitCount(habitId, dateKey, next);
  }, [habits, setHabitCount]);

  return { habits, loading, error, addHabit, updateHabit, deleteHabit, setHabitCount, toggleHabitDay };
}
