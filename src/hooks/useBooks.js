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

  // Pasted-text books: create/append return { book, paragraphs } with the
  // fresh translations; the book row is mirrored into the library list.
  const createFromText = useCallback(async ({ title, text }) => {
    const data = await api.createTextBook({ title, text });
    setBooks((prev) => [data.book, ...prev]);
    return data;
  }, []);

  const appendText = useCallback(async (id, text) => {
    const data = await api.appendBookText(id, text);
    setBooks((prev) => prev.map((b) => (b.id === id ? data.book : b)));
    return data;
  }, []);

  const rename = useCallback(async (id, title) => {
    const book = await api.updateBook(id, { title });
    setBooks((prev) => prev.map((b) => (b.id === id ? book : b)));
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

  return { books, loading, error, load, upload, createFromText, appendText, rename, removeBook, setProgress };
}
