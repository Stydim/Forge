import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

export function useBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listBooks();
      setError(null);
      setBooks(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(async ({ file, sourceLang, title, author }) => {
    const book = await api.uploadBook({ file, sourceLang, title, author });
    setBooks((prev) => [book, ...prev]);
    return book;
  }, []);

  const removeBook = useCallback(async (id) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    try {
      await api.deleteBook(id);
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

  const setProgress = useCallback(async (id, currentParagraph) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, current_paragraph: currentParagraph } : b)));
    try {
      await api.updateBook(id, { current_paragraph: currentParagraph });
    } catch {
      // Best-effort — losing a reading-position save isn't worth a reload/flicker.
    }
  }, []);

  return { books, loading, error, load, upload, removeBook, setProgress };
}
