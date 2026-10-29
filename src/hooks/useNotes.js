import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

// Notes and their categories (ported from Sanct). Updates are optimistic;
// a failed save reloads from the server.
export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotes();
      setNotes(data.notes);
      setCategories(data.categories);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fail = useCallback((err) => { setError(err.message); load(); }, [load]);

  const addNote = useCallback(async (fields) => {
    try {
      const row = await api.createNote(fields);
      setNotes((prev) => [row, ...prev]);
      return row;
    } catch (err) { setError(err.message); return null; }
  }, []);

  const updateNote = useCallback(async (id, fields) => {
    const now = new Date().toISOString();
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields, updated_at: now } : n)));
    try { await api.updateNote(id, fields); } catch (err) { fail(err); }
  }, [fail]);

  const deleteNote = useCallback(async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try { await api.deleteNote(id); } catch (err) { fail(err); }
  }, [fail]);

  const reorderNotes = useCallback(async (ids) => {
    setNotes((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, sort_order: ids.indexOf(n.id) } : n)));
    try { await api.reorderNotes(ids); } catch (err) { fail(err); }
  }, [fail]);

  const addCategory = useCallback(async (fields) => {
    try {
      const row = await api.createNoteCategory(fields);
      setCategories((prev) => [...prev, row]);
    } catch (err) { setError(err.message); }
  }, []);

  const updateCategory = useCallback(async (id, fields) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
    try { await api.updateNoteCategory(id, fields); } catch (err) { fail(err); }
  }, [fail]);

  const deleteCategory = useCallback(async (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try { await api.deleteNoteCategory(id); } catch (err) { fail(err); }
  }, [fail]);

  const reorderCategories = useCallback(async (ids) => {
    setCategories((prev) => ids.map((id, i) => ({ ...prev.find((c) => c.id === id), position: i })).filter((c) => c.id));
    try { await api.reorderNoteCategories(ids); } catch (err) { fail(err); }
  }, [fail]);

  return {
    notes, categories, loading, error,
    addNote, updateNote, deleteNote, reorderNotes,
    addCategory, updateCategory, deleteCategory, reorderCategories,
  };
}
