import { useState } from 'react';
import { DEFAULT_CHARACTER_ID } from '../lib/characters';

const STORAGE_KEY = 'forge:active-character-id';

export function useActiveCharacter() {
  const [activeCharacterId, setActiveCharacterIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_CHARACTER_ID; } catch { return DEFAULT_CHARACTER_ID; }
  });

  const setActiveCharacterId = (id) => {
    setActiveCharacterIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {
      // localStorage unavailable — selection just won't survive a reload.
    }
  };

  return [activeCharacterId, setActiveCharacterId];
}
