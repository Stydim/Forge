import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .eq('completed', false)
      .order('created_at', { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setTasks(data.map((t) => ({ ...t, subtasks: t.subtasks.sort((a, b) => a.position - b.position) })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completeTask = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error: err } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', id);
    if (err) { setError(err.message); load(); }
  }, [load]);

  const snoozeTask = useCallback(async (id, hours = 1) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDueAt = new Date(new Date(task.due_at ?? Date.now()).getTime() + hours * 3600000).toISOString();
    setTasks((prev) => prev.map((t) => (
      t.id === id ? { ...t, due_at: newDueAt, snooze_count: t.snooze_count + 1 } : t
    )));
    const updateRes = await supabase
      .from('tasks')
      .update({ due_at: newDueAt, snooze_count: task.snooze_count + 1 })
      .eq('id', id);
    if (updateRes.error) { setError(updateRes.error.message); load(); return; }

    // Best-effort: powers the "по часам" chart, but shouldn't block the snooze itself.
    supabase.from('snooze_events').insert({ task_id: id }).then(({ error: err }) => {
      if (err) console.warn('snooze_events insert failed:', err.message);
    });
  }, [tasks, load]);

  const toggleSubtask = useCallback(async (subtaskId, done) => {
    setTasks((prev) => prev.map((t) => ({
      ...t,
      subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)),
    })));
    const { error: err } = await supabase.from('subtasks').update({ done }).eq('id', subtaskId);
    if (err) { setError(err.message); load(); }
  }, [load]);

  const addTask = useCallback(async ({ title, due_at = null, recurrence_note = null }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({ kind: 'task', title: trimmed, due_at, recurrence_note })
      .select('*, subtasks(*)')
      .single();
    if (err) { setError(err.message); return; }
    setTasks((prev) => [...prev, { ...data, subtasks: [] }]);
  }, []);

  return { tasks, loading, error, completeTask, snoozeTask, toggleSubtask, addTask };
}
