import { useState } from 'react';
import { DEFAULT_BACKGROUND_ID } from '../lib/backgrounds';

const STORAGE_KEY = 'forge:background-id';

export function useBackground() {
  const [backgroundId, setBackgroundIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_BACKGROUND_ID; } catch { return DEFAULT_BACKGROUND_ID; }
  });

  const setBackgroundId = (id) => {
    setBackgroundIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {
      // localStorage unavailable — selection just won't survive a reload.
    }
  };

  return [backgroundId, setBackgroundId];
}
