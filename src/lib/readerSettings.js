import { useCallback, useState } from 'react';

// Reader typography the user can tune from the reader toolbar: one shared
// size plus a font and a colour each for the original and the translation.
// Kept per-device in localStorage — it's a display preference, not data.
const STORAGE_KEY = 'forge:reader-settings';

export const MIN_SIZE = 14;
export const MAX_SIZE = 28;

export const READER_FONTS = [
  { id: 'literata', label: 'Literata', css: "'Literata', Georgia, serif" },
  { id: 'ptserif', label: 'PT Serif', css: "'PT Serif', Georgia, serif" },
  { id: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  { id: 'golos', label: 'Golos', css: "'Golos Text', system-ui, sans-serif" },
  { id: 'ptsans', label: 'PT Sans', css: "'PT Sans', Arial, sans-serif" },
  { id: 'nunito', label: 'Nunito', css: "'Nunito', system-ui, sans-serif" },
];

export const READER_COLORS = [
  { id: 'ink', label: 'Чёрный', css: 'var(--text-primary)' },
  { id: 'graphite', label: 'Графит', css: '#4B4A47' },
  { id: 'navy', label: 'Синий', css: '#24466B' },
  { id: 'teal', label: 'Бирюзовый', css: 'var(--accent-teal-dark)' },
  { id: 'brown', label: 'Коричневый', css: '#7A4E2D' },
  { id: 'amber', label: 'Янтарный', css: '#B8642E' },
];

const DEFAULTS = {
  fontSize: 19,
  origFont: 'literata',
  origColor: 'ink',
  trFont: 'golos',
  trColor: 'navy',
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

const fontCss = (id) => (READER_FONTS.find((f) => f.id === id) || READER_FONTS[0]).css;
const colorCss = (id) => (READER_COLORS.find((c) => c.id === id) || READER_COLORS[0]).css;

export function useReaderSettings() {
  const [settings, setSettings] = useState(load);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      next.fontSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, next.fontSize));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    setSettings(DEFAULTS);
  }, []);

  // Inline styles for the two kinds of text, ready to spread onto elements.
  const origStyle = { fontSize: settings.fontSize, fontFamily: fontCss(settings.origFont), color: colorCss(settings.origColor) };
  const trStyle = { fontSize: settings.fontSize, fontFamily: fontCss(settings.trFont), color: colorCss(settings.trColor) };

  return { settings, update, reset, origStyle, trStyle };
}
