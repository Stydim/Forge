import { useCallback, useEffect, useState } from 'react';

// Time tracker for one task at a time (ported from Sanct). Unlike Sanct it
// survives page reloads: the running session is kept in localStorage as
// { taskId, startedAt (ms, null while paused), accumulated (s) }.
const STORAGE_KEY = 'forge:task-timer';

function load() {
  try {
    const t = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return t && t.taskId ? t : null;
  } catch {
    return null;
  }
}

function persist(t) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode — the timer just won't survive a reload */ }
}

// Seconds in the current session, at time `now`.
export function sessionSeconds(timer, now = Date.now()) {
  if (!timer) return 0;
  return timer.accumulated + (timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0);
}

// Ticks once a second while `active`, so elapsed times re-render.
export function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// onLog(taskId, seconds) records a finished session on the task.
export function useTaskTimer(onLog) {
  const [timer, setTimer] = useState(load);

  const update = useCallback((next) => {
    persist(next);
    setTimer(next);
  }, []);

  // Stops the current session and logs it; returns the seconds logged.
  const stop = useCallback(() => {
    const t = load();
    if (!t) return 0;
    const secs = sessionSeconds(t);
    update(null);
    if (secs > 0) onLog(t.taskId, secs);
    return secs;
  }, [onLog, update]);

  const start = useCallback((taskId) => {
    const t = load();
    if (t && t.taskId !== taskId) stop(); // one task at a time: log the other first
    const cur = load();
    if (cur && cur.taskId === taskId) {
      if (!cur.startedAt) update({ ...cur, startedAt: Date.now() }); // resume
      return;
    }
    update({ taskId, startedAt: Date.now(), accumulated: 0 });
  }, [stop, update]);

  const pause = useCallback(() => {
    const t = load();
    if (!t || !t.startedAt) return;
    update({ ...t, startedAt: null, accumulated: sessionSeconds(t) });
  }, [update]);

  // Throws the current session away without logging it.
  const reset = useCallback(() => update(null), [update]);

  // Another tab changed the timer: follow it.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setTimer(load()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { timer, running: !!timer?.startedAt, start, pause, stop, reset };
}
