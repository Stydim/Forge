import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

export function useArchive(onChange) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listArchivedTasks();
      setError(null);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const restoreTask = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.updateTask(id, { completed: false, completed_at: null });
      onChange?.();
    } catch (err) {
      setError(err.message); load();
    }
  }, [load, onChange]);

  const deleteForever = useCallback(async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  const deleteMany = useCallback(async (ids) => {
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    try {
      await api.deleteTasks(ids);
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  return { tasks, loading, error, restoreTask, deleteForever, deleteMany };
}
