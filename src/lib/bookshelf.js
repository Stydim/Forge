// Places on the bookshelf photo (src/assets/bookshelf.jpg, 1600x1200) where
// a library book can stand. Rects are in the photo's own pixels and sit just
// inside each real spine; the printed titles inside them are painted out at
// load time, and the user's book title is drawn on top instead.
// `dir: 'v'` — upright spine (title reads top-to-bottom), 'h' — book lying flat.
export const SHELF_IMAGE_SIZE = { w: 1600, h: 1200 };

export const SHELF_SLOTS = [
  // Top shelf
  { x: 1064, y: 14, w: 86, h: 328, dir: 'v' },
  { x: 1158, y: 4, w: 54, h: 338, dir: 'v' },
  { x: 1219, y: 4, w: 64, h: 338, dir: 'v' },
  { x: 1292, y: 14, w: 46, h: 328, dir: 'v' },
  // Middle shelf
  { x: 1103, y: 448, w: 83, h: 356, dir: 'v' },
  { x: 1192, y: 440, w: 51, h: 364, dir: 'v' },
  { x: 1250, y: 448, w: 59, h: 356, dir: 'v' },
  { x: 1317, y: 460, w: 51, h: 344, dir: 'v' },
  // Bottom shelf
  { x: 401, y: 868, w: 82, h: 310, dir: 'v' },
  { x: 489, y: 884, w: 31, h: 294, dir: 'v' },
  { x: 525, y: 868, w: 81, h: 310, dir: 'v' },
  { x: 612, y: 880, w: 46, h: 298, dir: 'v' },
  { x: 663, y: 870, w: 92, h: 308, dir: 'v' },
  { x: 762, y: 890, w: 38, h: 288, dir: 'v' },
  { x: 808, y: 870, w: 102, h: 308, dir: 'v' },
  { x: 917, y: 880, w: 46, h: 298, dir: 'v' },
  { x: 968, y: 875, w: 110, h: 303, dir: 'v' },
  // Books lying flat
  { x: 1122, y: 1094, w: 374, h: 44, dir: 'h' },
  { x: 1104, y: 1148, w: 408, h: 42, dir: 'h' },
];
