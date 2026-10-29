// Habit icons ported from Sanct: 12 Apple 3D emoji (PNG from the
// emoji-datasource-apple CDN, same look on every platform) stored by key
// ('yoga', 'run', …). Any other value is a plain emoji typed by hand.
const APPLE_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64';

export const HABIT_ICONS = [
  { key: 'yoga', hex: '1f9d8-200d-2640-fe0f' },
  { key: 'run', hex: '1f3c3' },
  { key: 'books', hex: '1f4da' },
  { key: 'water', hex: '1f4a7' },
  { key: 'salad', hex: '1f957' },
  { key: 'laptop', hex: '1f4bb' },
  { key: 'palette', hex: '1f3a8' },
  { key: 'music', hex: '1f3b5' },
  { key: 'brain', hex: '1f9e0' },
  { key: 'money', hex: '1f4b0' },
  { key: 'strong', hex: '1f4aa' },
  { key: 'sleep', hex: '1f6cf-fe0f' },
];

// Sanct's older habits stored the emoji itself — show those as 3D icons too.
const EMOJI_TO_KEY = {
  '🧘‍♀️': 'yoga', '🧘': 'yoga', '🏃': 'run', '📚': 'books', '💧': 'water',
  '🥗': 'salad', '💻': 'laptop', '🎨': 'palette', '🎵': 'music', '🧠': 'brain',
  '💰': 'money', '💪': 'strong', '🛌': 'sleep', '🛏️': 'sleep',
};

export function isIconKey(icon) {
  return HABIT_ICONS.some((h) => h.key === icon);
}

// A legacy emoji that has a 3D twin → that icon's key; anything else as is.
export function normalizeIcon(icon) {
  return EMOJI_TO_KEY[icon] || icon || '';
}

function iconUrl(icon) {
  const key = isIconKey(icon) ? icon : EMOJI_TO_KEY[icon];
  const found = HABIT_ICONS.find((h) => h.key === key);
  return found ? `${APPLE_CDN}/${found.hex}.png` : null;
}

export function HabitIconImg({ icon, size = 28 }) {
  const url = iconUrl(icon);
  if (url) return <img src={url} width={size} height={size} alt="" draggable={false} className="habit-icon-img" />;
  return <span style={{ fontSize: size * 0.65, lineHeight: 1 }}>{icon || '⭐'}</span>;
}

// The round tinted badge used on cards and in the stats window.
export function HabitIcon({ habit, size = 40 }) {
  return (
    <div
      className="habit-icon-badge"
      style={{ background: `${habit.color}22`, color: habit.color, width: size, height: size }}
    >
      <HabitIconImg icon={habit.icon} size={Math.round(size * 0.68)} />
    </div>
  );
}
