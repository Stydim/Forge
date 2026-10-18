import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

export function useSavedWords() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listSavedWords();
      setError(null);
      setWords(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isSaved = useCallback((word) => (
    words.some((w) => w.word.toLowerCase() === word.toLowerCase())
  ), [words]);

  const save = useCallback(async (gloss) => {
    const word = await api.saveWord(gloss);
    setWords((prev) => [word, ...prev]);
    return word;
  }, []);

  const remove = useCallback(async (id) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
    try {
      await api.deleteSavedWord(id);
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  return { words, loading, error, load, isSaved, save, remove };
}
