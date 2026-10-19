import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';

// Saved quotes. `quotes` is ordered pinned-first, so quotes[0] is the one the
// library's picture frame shows.
export function useQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setQuotes(await api.listQuotes());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A new quote comes back pinned, so it goes to the front.
  const add = useCallback(async ({ text, author, bookId }) => {
    const quote = await api.createQuote({ text, author, book_id: bookId || null });
    setQuotes((prev) => [quote, ...prev.map((q) => ({ ...q, pinned: false }))]);
    return quote;
  }, []);

  const pin = useCallback(async (id) => {
    setQuotes((prev) => {
      const q = prev.find((x) => x.id === id);
      return q ? [{ ...q, pinned: true }, ...prev.filter((x) => x.id !== id).map((x) => ({ ...x, pinned: false }))] : prev;
    });
    try { await api.pinQuote(id); } catch (err) { setError(err.message); load(); }
  }, [load]);

  const remove = useCallback(async (id) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    try { await api.deleteQuote(id); } catch (err) { setError(err.message); load(); }
  }, [load]);

  return { quotes, error, load, add, pin, remove };
}
