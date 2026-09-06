export const BACKGROUNDS = [
  { id: 'soft-blue', name: 'Спокойный', url: '/backgrounds/soft-blue.jpg' },
  { id: 'deep-space', name: 'Космос', url: '/backgrounds/deep-space.jpg' },
  { id: 'golden-nebula', name: 'Туманность', url: '/backgrounds/golden-nebula.jpg' },
  { id: 'neon-flow', name: 'Неон', url: '/backgrounds/neon-flow.jpg' },
  { id: 'watercolor-galaxy', name: 'Акварель', url: '/backgrounds/watercolor-galaxy.jpg' },
  { id: 'aurora-clouds', name: 'Сияние', url: '/backgrounds/aurora-clouds.jpg' },
  { id: 'amber-haze', name: 'Дымка', url: '/backgrounds/amber-haze.jpg' },
];

export const DEFAULT_BACKGROUND_ID = 'none';

export function getBackground(id) {
  return BACKGROUNDS.find((b) => b.id === id) ?? null;
}
