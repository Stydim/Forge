import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

const byDate = (a, b) => new Date(a.measured_at) - new Date(b.measured_at);

// Weight tracker data: weighings (oldest first) and the goal/height settings.
// Updates are optimistic; a failed save reloads from the server.
export function useWeight() {
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ goal_kg: null, height_cm: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getWeight();
      setLogs([...data.logs].sort(byDate));
      setSettings(data.settings);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addLog = useCallback(async (fields) => {
    try {
      const row = await api.createWeightLog(fields);
      setLogs((prev) => [...prev, row].sort(byDate));
    } catch (err) { setError(err.message); }
  }, []);

  const updateLog = useCallback(async (id, fields) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)).sort(byDate));
    try { await api.updateWeightLog(id, fields); } catch (err) { setError(err.message); load(); }
  }, [load]);

  const deleteLog = useCallback(async (id) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    try { await api.deleteWeightLog(id); } catch (err) { setError(err.message); load(); }
  }, [load]);

  const saveSettings = useCallback(async (fields) => {
    setSettings((prev) => ({ ...prev, ...fields }));
    try { await api.saveWeightSettings(fields); } catch (err) { setError(err.message); load(); }
  }, [load]);

  return { logs, settings, loading, error, addLog, updateLog, deleteLog, saveSettings };
}
