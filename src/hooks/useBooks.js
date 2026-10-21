import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import { SHELF_SLOTS } from '../lib/bookshelf';

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

  const booksRef = useRef(books);
  useEffect(() => { booksRef.current = books; }, [books]);

  const upload = useCallback(async ({ file, sourceLang, title, author, plainOnly }) => {
    const book = await api.uploadBook({ file, sourceLang, title, author, plainOnly });
    setBooks((prev) => [book, ...prev]);
    return book;
  }, []);

  // Pasted-text books: create/append return { book, paragraphs } with the
  // fresh translations; the book row is mirrored into the library list.
  const createFromText = useCallback(async ({ title, text, plainOnly }) => {
    const data = await api.createTextBook({ title, text, plainOnly });
    setBooks((prev) => [data.book, ...prev]);
    return data;
  }, []);

  const appendText = useCallback(async (id, text) => {
    const data = await api.appendBookText(id, text);
    setBooks((prev) => prev.map((b) => (b.id === id ? data.book : b)));
    return data;
  }, []);

  // Edits plain book fields (title, plain_only) and mirrors them in the list.
  const updateFields = useCallback(async (id, fields) => {
    const book = await api.updateBook(id, fields);
    setBooks((prev) => prev.map((b) => (b.id === id ? book : b)));
    return book;
  }, []);

  const rename = useCallback(async (id, title) => {
    const book = await api.updateBook(id, { title });
    setBooks((prev) => prev.map((b) => (b.id === id ? book : b)));
    return book;
  }, []);

  // Puts a book on a shelf place (or takes it off with slot = null). If
  // another book already stands there, the two swap places; if the moved
  // book wasn't on the shelf yet, the displaced one moves to the first free
  // place instead of silently dropping off the shelf.
  const place = useCallback(async (id, slot) => {
    const current = booksRef.current;
    const oldSlot = current.find((b) => b.id === id)?.shelf_slot ?? null;
    const occupant = slot == null ? null : current.find((b) => b.shelf_slot === slot && b.id !== id);
    let occupantSlot = oldSlot;
    if (occupant && occupantSlot == null) {
      const taken = new Set(current.map((b) => b.shelf_slot).filter((s) => s != null));
      const free = SHELF_SLOTS.findIndex((_, i) => !taken.has(i));
      occupantSlot = free === -1 ? null : free;
    }
    setBooks((prev) => prev.map((b) => {
      if (b.id === id) return { ...b, shelf_slot: slot };
      if (occupant && b.id === occupant.id) return { ...b, shelf_slot: occupantSlot };
      return b;
    }));
    try {
      await api.updateBook(id, { shelf_slot: slot });
      if (occupant && occupantSlot != null) await api.updateBook(occupant.id, { shelf_slot: occupantSlot });
    } catch (err) {
      setError(err.message); load();
    }
  }, [load]);

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

  return { books, loading, error, load, upload, createFromText, appendText, rename, updateFields, place, removeBook, setProgress };
}
