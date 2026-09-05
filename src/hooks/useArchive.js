import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useArchive(onChange) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', true)
      .order('completed_at', { ascending: false });

    if (err) setError(err.message);
    else { setError(null); setTasks(data); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const restoreTask = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error: err } = await supabase
      .from('tasks')
      .update({ completed: false, completed_at: null })
      .eq('id', id);
    if (err) { setError(err.message); load(); return; }
    onChange?.();
  }, [load, onChange]);

  const deleteForever = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error: err } = await supabase.from('tasks').delete().eq('id', id);
    if (err) { setError(err.message); load(); }
  }, [load]);

  return { tasks, loading, error, restoreTask, deleteForever };
}
