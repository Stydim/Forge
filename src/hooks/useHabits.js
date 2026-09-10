import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
    const { data, error: err } = await supabase
      .from('habits')
      .select('*, habit_completions(*)')
      .eq('archived', false)
      .order('created_at', { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setHabits(data.map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addHabit = useCallback(async ({ title, icon, color, targetDays, timesPerDay = 1 }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const { data, error: err } = await supabase
      .from('habits')
      .insert({
        title: trimmed,
        icon: icon?.trim() || null,
        color,
        target_days: targetDays && targetDays.length ? targetDays : null,
        times_per_day: timesPerDay,
      })
      .select('*')
      .single();
    if (err) { setError(err.message); return; }
    setHabits((prev) => [...prev, mapRow(data)]);
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
    const { error: err } = await supabase.from('habits').update(fields).eq('id', id);
    if (err) { setError(err.message); load(); return; }
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...fields } : h)));
  }, [load]);

  // Archive rather than hard-delete, same spirit as tasks going to the
  // archive on completion — keeps the completion history intact.
  const deleteHabit = useCallback(async (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    const { error: err } = await supabase.from('habits').update({ archived: true }).eq('id', id);
    if (err) { setError(err.message); load(); }
  }, [load]);

  // Sets the exact completion count for one habit on one day (the chip UI
  // computes this — clicking chip i means "i+1 done" or "i done" if undoing).
  const setHabitCount = useCallback(async (habitId, dateKey, count) => {
    setHabits((prev) => prev.map((h) => (
      h.id === habitId ? { ...h, completions: { ...h.completions, [dateKey]: count } } : h
    )));
    const { error: err } = await supabase
      .from('habit_completions')
      .upsert({ habit_id: habitId, date: dateKey, count }, { onConflict: 'habit_id,date' });
    if (err) { setError(err.message); load(); }
  }, [load]);

  return { habits, loading, error, addHabit, updateHabit, deleteHabit, setHabitCount };
}
