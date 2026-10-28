// Task details ported from Sanct: priority levels, the emoji quick-insert
// row, colour palettes for categories and tags, and time formatting.

export const PRIORITIES = [
  { value: 'high', label: 'Высокий', color: '#FF6B6B' },
  { value: 'medium', label: 'Средний', color: '#FDCB6E' },
  { value: 'low', label: 'Низкий', color: '#0984E3' },
  { value: 'none', label: 'Без приоритета', color: '#00B894' },
];
export const priorityOf = (value) => PRIORITIES.find((p) => p.value === value) || PRIORITIES[3];

export const EMOJIS = ['⭐', '🔥', '💡', '✅', '📌', '🎯', '✨', '💪', '🚀', '❤️', '👍', '⚠️', '💰', '🏆', '🎉', '💬', '🔑', '🌱', '🎨', '📊', '🔍', '💎'];

// Emoji icons offered for a category.
export const CATEGORY_ICONS = ['❤️', '💼', '📚', '🏃', '⚽', '🎨', '🏠', '🛒', '💰', '✈️', '🎵', '🧘', '🐾', '🍳', '💻', '🌱', '🎯', '📦'];
export const CATEGORY_COLORS = ['#FF8E7D', '#6C5CE7', '#00B894', '#FF6B6B', '#FDCB6E', '#0984E3', '#4A90D9', '#9B8BC4', '#FF8C5A', '#E84393'];
export const TAG_COLORS = ['#FF6B6B', '#00B894', '#0984E3', '#6C5CE7', '#E17055', '#FDCB6E', '#E84393', '#00CEC9'];

// 1ч 25м / 40м / 15с
export function formatDurationShort(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}ч ${m}м`;
  if (h > 0) return `${h}ч`;
  if (m > 0) return `${m}м`;
  return `${s}с`;
}

// 01:05:09 / 05:09
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const newChecklistItem = (title) => ({
  id: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`,
  title,
  done: false,
});

// Unticked checklist items — a task can't be marked done while any remain.
export const openChecklistCount = (task) => (task.checklist || []).filter((c) => !c.done).length;
