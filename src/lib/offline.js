// Offline reading: a copy of the library list and of every book opened in
// Читалка (text, highlights, bookmarks) in IndexedDB, plus an outbox of
// changes made without a network — reading position, highlights, notes,
// bookmarks — sent in order once the server can be reached again.
import { useEffect, useState } from 'react';
import { request } from './api';

const DB_NAME = 'forge-offline';
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('meta'); // 'books' -> the library list
        db.createObjectStore('texts'); // book id -> { book, paragraphs, highlights, bookmarks }
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

// Runs fn(store(s)) in one transaction; resolves with fn's request result
// (if it returns one) once the transaction commits.
async function tx(stores, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const s = Array.isArray(stores) ? stores.map((n) => t.objectStore(n)) : t.objectStore(stores);
    const req = fn(s);
    t.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// Storage can be unavailable (private mode, quota): the app then just works
// online as before.
const safe = (p, fallback) => p.catch(() => fallback);

export const getCachedBooks = () => safe(tx('meta', 'readonly', (s) => s.get('books')), undefined);
export const putCachedBooks = (books) => safe(tx('meta', 'readwrite', (s) => s.put(books, 'books')));
export const getCachedText = (bookId) => safe(tx('texts', 'readonly', (s) => s.get(bookId)), undefined);

// Merges `fields` into a book's saved copy (creating it if needed).
export const putCachedText = (bookId, fields) => safe(tx('texts', 'readwrite', (s) => {
  const get = s.get(bookId);
  get.onsuccess = () => s.put({ ...(get.result || {}), ...fields, savedAt: Date.now() }, bookId);
}));

// Updates a book's row in both the saved library list and its saved text.
export const patchCachedBook = (bookId, fields) => safe(tx(['meta', 'texts'], 'readwrite', ([meta, texts]) => {
  const list = meta.get('books');
  list.onsuccess = () => {
    if (Array.isArray(list.result)) meta.put(list.result.map((b) => (b.id === bookId ? { ...b, ...fields } : b)), 'books');
  };
  const text = texts.get(bookId);
  text.onsuccess = () => {
    if (text.result?.book) texts.put({ ...text.result, book: { ...text.result.book, ...fields } }, bookId);
  };
}));

// --- Connection state ---------------------------------------------------
// Offline = the browser says so, or the last request couldn't reach the
// server. `pending` = changes waiting in the outbox.
let state = { unreachable: false, pending: 0 };
const listeners = new Set();
function setState(patch) {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}
export function useConnection() {
  const [s, setS] = useState(state);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    listeners.add(setS);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { listeners.delete(setS); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return { offline: !online || s.unreachable, pending: s.pending };
}

// Wraps a read: marks the server reachable/unreachable as it goes.
export async function online(fn) {
  try {
    const out = await fn();
    if (state.unreachable) setState({ unreachable: false });
    return out;
  } catch (err) {
    if (err.offline) setState({ unreachable: true });
    throw err;
  }
}

// --- Outbox -------------------------------------------------------------
const countOutbox = () => safe(tx('outbox', 'readonly', (s) => s.count()), 0);
const refreshPending = async () => setState({ pending: await countOutbox() });

// Adds a change; one with the same `key` (e.g. a book's reading position)
// replaces the older one instead of queueing up behind it.
async function enqueue(item) {
  await safe(tx('outbox', 'readwrite', (s) => {
    if (!item.key) { s.add(item); return; }
    const all = s.getAll();
    all.onsuccess = () => {
      for (const old of all.result) if (old.key === item.key) s.delete(old.seq);
      s.add(item);
    };
  }));
  await refreshPending();
}

let flushing = null;

// Sends queued changes oldest first. Stops at the first one the server can't
// be reached for (kept for next time); a change the server rejects (e.g. a
// highlight in a book deleted meanwhile) is dropped so it can't block the rest.
export function flushOutbox() {
  if (navigator.onLine === false) return Promise.resolve();
  if (!flushing) {
    flushing = (async () => {
      const items = await safe(tx('outbox', 'readonly', (s) => s.getAll()), []);
      for (const item of items) {
        try {
          await request(item.path, { method: item.method, body: item.body == null ? undefined : JSON.stringify(item.body) });
        } catch (err) {
          if (err.offline) { setState({ unreachable: true }); break; }
          console.warn('Offline change rejected by the server, dropped:', item, err.message);
        }
        await safe(tx('outbox', 'readwrite', (s) => s.delete(item.seq)));
        if (state.unreachable) setState({ unreachable: false });
      }
      await refreshPending();
    })().finally(() => { flushing = null; });
  }
  return flushing;
}

// Whether changes for this book are still waiting to be sent.
export const hasPending = (bookId) => safe(tx('outbox', 'readonly', (s) => s.getAll()), [])
  .then((items) => items.some((i) => i.bookId === bookId));

// Sends a change now if possible, otherwise queues it. Resolves with the
// server's answer, or null when queued (the caller then keeps its own
// optimistic version). Changes made while others still wait in the outbox
// queue behind them, so they reach the server in the order they were made.
export async function send(path, { method, body, bookId, key }) {
  const item = { path, method, body: body ?? null, bookId, key };
  // Known to be offline: queue at once rather than wait on a failing request
  // (the outbox is retried on 'online' and every half minute).
  if (navigator.onLine === false || state.unreachable) { await enqueue(item); return null; }
  if (state.pending > 0 || (await countOutbox()) > 0) {
    await flushOutbox();
    if ((await countOutbox()) > 0) { await enqueue(item); return null; }
  }
  try {
    const out = await request(path, { method, body: body == null ? undefined : JSON.stringify(body) });
    if (state.unreachable) setState({ unreachable: false });
    return out;
  } catch (err) {
    if (!err.offline) throw err;
    setState({ unreachable: true });
    await enqueue(item);
    return null;
  }
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// Send what's waiting when the network comes back, on start, and every
// half minute while something is waiting (a server that was asleep).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { setState({ unreachable: false }); flushOutbox(); });
  refreshPending().then(() => { if (state.pending) flushOutbox(); });
  setInterval(() => { if (state.pending && navigator.onLine !== false) flushOutbox(); }, 30000);
}
