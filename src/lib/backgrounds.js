export const BACKGROUNDS = [
  { id: 'soft-blue', name: 'Спокойный', url: '/backgrounds/soft-blue.jpg' },
  { id: 'deep-space', name: 'Космос', url: '/backgrounds/deep-space.jpg' },
  { id: 'golden-nebula', name: 'Туманность', url: '/backgrounds/golden-nebula.jpg' },
];

export const DEFAULT_BACKGROUND_ID = 'none';

export function getBackground(id) {
  return BACKGROUNDS.find((b) => b.id === id) ?? null;
}
