// Persists each task's last-generated dialogue across full page reloads
// (in-memory state/refs don't survive those). Keyed by character+task; a new
// entry only overwrites the old one when the task's stage changes.
import { DEFAULT_CHARACTER_ID } from './characters';

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

// Keyed by character too — switching the active character must not show a
// cached line generated in the previous character's voice.
export function getDialogue(characterId, taskId) {
  const keyed = cache.get(`${characterId}:${taskId}`);
  if (keyed) return keyed;
  // Back-compat: entries saved before character-switching existed were keyed
  // by bare task id — they're all gnome lines (it was the only character).
  // Without this, every such entry looks like a cache miss after this
  // update ships, and regenerates once for no reason (real API spend).
  if (characterId === DEFAULT_CHARACTER_ID) return cache.get(taskId);
  return undefined;
}

export function setDialogue(characterId, taskId, stage, lines) {
  cache.set(`${characterId}:${taskId}`, { stage, lines });
  saveToStorage(cache);
}
