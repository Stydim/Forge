import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/api';
import { isHabitEnded } from '../lib/habitStreak';

function mapRow(row) {
  const completions = {};
  for (const c of row.habit_completions ?? []) completions[c.date] = c.count;
  const { habit_completions, ...rest } = row;
  return { ...rest, completions };
}

export function useHabits() {
  // Every habit, archived ones included; split into views at the end.
  const [allHabits, setHabits] = useState([]);
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

  const addHabit = useCallback(async ({ title, icon, color, targetDays, timesPerDay = 1, endDate = null }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const data = await api.createHabit({
        title: trimmed,
        icon: icon?.trim() || null,
        color,
        target_days: targetDays && targetDays.length ? targetDays : null,
        times_per_day: timesPerDay,
        end_date: endDate || null,
      });
      setHabits((prev) => [...prev, mapRow(data)]);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const updateHabit = useCallback(async (id, { title, icon, color, targetDays, timesPerDay = 1, endDate = null }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const fields = {
      title: trimmed,
      icon: icon?.trim() || null,
      color,
      target_days: targetDays && targetDays.length ? targetDays : null,
      times_per_day: timesPerDay,
      end_date: endDate || null,
    };
    try {
      await api.updateHabit(id, fields);
      setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...fields } : h)));
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  // Archive keeps the habit and its history (restorable from the archive
  // page); delete removes it with its completions for good.
  const setArchived = useCallback(async (id, archived) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, archived } : h)));
    try {
      await api.updateHabit(id, { archived });
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);
  const archiveHabit = useCallback((id) => setArchived(id, true), [setArchived]);
  const restoreHabit = useCallback((id) => setArchived(id, false), [setArchived]);

  const deleteHabit = useCallback(async (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    try {
      await api.deleteHabit(id);
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
    const habit = allHabits.find((h) => h.id === habitId);
    if (!habit) return;
    const current = habit.completions[dateKey] || 0;
    const next = current < habit.times_per_day ? current + 1 : 0;
    return setHabitCount(habitId, dateKey, next);
  }, [allHabits, setHabitCount]);

  // habits: everything not archived (finished ones too — the page lists
  // them separately); activeHabits: not archived and not past end_date.
  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);
  const activeHabits = useMemo(() => habits.filter((h) => !isHabitEnded(h)), [habits]);
  const archivedHabits = useMemo(() => allHabits.filter((h) => h.archived), [allHabits]);

  return {
    habits, activeHabits, archivedHabits, loading, error,
    addHabit, updateHabit, deleteHabit, archiveHabit, restoreHabit, setHabitCount, toggleHabitDay,
  };
}
