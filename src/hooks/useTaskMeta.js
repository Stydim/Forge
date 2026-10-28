import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

// Task categories and tags (the catalogues tasks pick from), with CRUD.
// onTagRenamed/onTagDeleted/onCategoryDeleted let the task list mirror what
// the server does to existing tasks (tag arrays rewritten, category cleared).
export function useTaskMeta({ onTagRenamed, onTagDeleted, onCategoryDeleted } = {}) {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [cats, tgs] = await Promise.all([api.listTaskCategories(), api.listTaskTags()]);
      setCategories(cats);
      setTags(tgs);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCategory = useCallback(async (fields) => {
    const cat = await api.createTaskCategory(fields);
    setCategories((prev) => [...prev, cat]);
    return cat;
  }, []);

  const updateCategory = useCallback(async (id, fields) => {
    const cat = await api.updateTaskCategory(id, fields);
    setCategories((prev) => prev.map((c) => (c.id === id ? cat : c)));
    return cat;
  }, []);

  const deleteCategory = useCallback(async (id) => {
    await api.deleteTaskCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    onCategoryDeleted?.(id);
  }, [onCategoryDeleted]);

  const addTag = useCallback(async (fields) => {
    const tag = await api.createTaskTag(fields);
    setTags((prev) => [...prev.filter((t) => t.id !== tag.id), tag]);
    return tag;
  }, []);

  const updateTag = useCallback(async (id, fields) => {
    const before = tags.find((t) => t.id === id);
    const tag = await api.updateTaskTag(id, fields);
    setTags((prev) => prev.map((t) => (t.id === id ? tag : t)));
    if (before && before.name !== tag.name) onTagRenamed?.(before.name, tag.name);
    return tag;
  }, [tags, onTagRenamed]);

  const deleteTag = useCallback(async (id) => {
    const tag = tags.find((t) => t.id === id);
    await api.deleteTaskTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    if (tag) onTagDeleted?.(tag.name);
  }, [tags, onTagDeleted]);

  return { categories, tags, error, load, addCategory, updateCategory, deleteCategory, addTag, updateTag, deleteTag };
}
