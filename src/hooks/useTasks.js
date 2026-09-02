import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getNextOccurrence } from '../lib/recurrence';

async function createSubtaskRows(taskId, count) {
  if (count <= 1) return [];
  const rows = Array.from({ length: Math.min(count, 10) }, (_, i) => ({
    task_id: taskId,
    label: String(i + 1),
    position: i,
  }));
  const { data, error } = await supabase.from('subtasks').insert(rows).select('*');
  if (error) {
    console.warn('subtask creation failed:', error.message);
    return [];
  }
  return data.sort((a, b) => a.position - b.position);
}

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

  // Marks a task done and, if it has a repeat rule, spawns the next occurrence
  // (fresh due date, zeroed counters, fresh 1..N chips) so the series keeps going.
  const completeAndRespawn = useCallback(async (task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    const { error: err } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', task.id);
    if (err) { setError(err.message); load(); return; }

    if (!task.repeat_type || task.repeat_type === 'none') return;

    const nextDate = getNextOccurrence(task.due_at, task.repeat_type, task.repeat_days);
    if (!nextDate) return;

    const { data: newTask, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        kind: 'task',
        title: task.title,
        due_at: nextDate.toISOString(),
        recurrence_note: task.recurrence_note,
        repeat_type: task.repeat_type,
        repeat_days: task.repeat_days,
        times_per_day: task.times_per_day,
      })
      .select('*, subtasks(*)')
      .single();
    if (insertErr) { setError(insertErr.message); return; }

    const subtasks = await createSubtaskRows(newTask.id, task.times_per_day);
    setTasks((prev) => [...prev, { ...newTask, subtasks }]);
  }, [load]);

  const completeTask = useCallback((id) => {
    const task = tasks.find((t) => t.id === id);
    if (task) completeAndRespawn(task);
  }, [tasks, completeAndRespawn]);

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
    if (err) { setError(err.message); load(); return; }

    // Checking off the last of today's "N раз в день" chips completes the task
    // (and, if it repeats, spawns tomorrow's occurrence with fresh chips).
    // Goal step chips (kind: 'goal') don't trigger this — goals have no "done" state yet.
    if (!done) return;
    const owner = tasks.find((t) => t.subtasks.some((s) => s.id === subtaskId));
    if (!owner || owner.kind !== 'task') return;
    const allDone = owner.subtasks.every((s) => (s.id === subtaskId ? true : s.done));
    if (allDone) completeAndRespawn(owner);
  }, [tasks, load, completeAndRespawn]);

  const addTask = useCallback(async ({
    title,
    due_at = null,
    recurrence_note = null,
    timesPerDay = 1,
    repeatType = 'none',
    repeatDays = null,
  }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({
        kind: 'task',
        title: trimmed,
        due_at,
        recurrence_note,
        repeat_type: repeatType,
        repeat_days: repeatDays && repeatDays.length ? repeatDays : null,
        times_per_day: timesPerDay,
      })
      .select('*, subtasks(*)')
      .single();
    if (err) { setError(err.message); return; }

    const subtasks = await createSubtaskRows(data.id, timesPerDay);
    setTasks((prev) => [...prev, { ...data, subtasks }]);
  }, []);

  return { tasks, loading, error, completeTask, snoozeTask, toggleSubtask, addTask };
}
