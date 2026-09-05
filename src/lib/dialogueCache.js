// Persists each task's last-generated gnome dialogue across full page
// reloads (in-memory state/refs don't survive those). Keyed by task id;
// a new entry only overwrites the old one when the task's stage changes.
const STORAGE_KEY = 'forge:gnome-dialogue-cache';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveToStorage(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // localStorage unavailable or full — cache just won't persist, not fatal.
  }
}

const cache = loadFromStorage();

export function getDialogue(taskId) {
  return cache.get(taskId);
}

export function setDialogue(taskId, stage, lines) {
  cache.set(taskId, { stage, lines });
  saveToStorage(cache);
}
