// `dark` says whether elements with no opaque background of their own (the
// AI quick-add row, sidebar nav text) need light-on-dark styling over this
// photo instead of the app's normal dark-on-cream. Measured, not guessed —
// average image color blended with the cream scrim, then relative luminance
// against a 0.55 threshold (see the session that added this for the script).
export const BACKGROUNDS = [
  { id: 'soft-blue', name: 'Спокойный', url: '/backgrounds/soft-blue.jpg', dark: false },
  { id: 'deep-space', name: 'Космос', url: '/backgrounds/deep-space.jpg', dark: true },
  { id: 'golden-nebula', name: 'Туманность', url: '/backgrounds/golden-nebula.jpg', dark: false },
  { id: 'neon-flow', name: 'Неон', url: '/backgrounds/neon-flow.jpg', dark: true },
  { id: 'watercolor-galaxy', name: 'Акварель', url: '/backgrounds/watercolor-galaxy.jpg', dark: false },
  { id: 'aurora-clouds', name: 'Сияние', url: '/backgrounds/aurora-clouds.jpg', dark: true },
  { id: 'amber-haze', name: 'Дымка', url: '/backgrounds/amber-haze.jpg', dark: false },
];

export const DEFAULT_BACKGROUND_ID = 'none';

export function getBackground(id) {
  return BACKGROUNDS.find((b) => b.id === id) ?? null;
}
