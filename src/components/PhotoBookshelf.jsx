import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import shelfUrl from '../assets/bookshelf.jpg';
import { SHELF_IMAGE_SIZE, SHELF_SLOTS } from '../lib/bookshelf';

const median = (arr) => {
  arr.sort((a, b) => a - b);
  return arr[arr.length >> 1];
};

// Paints out whatever is printed on a spine: every pixel line across the
// spine (a column for upright books, a row for lying ones) is replaced by its
// median colour. That keeps the spine's rounded light/shadow falloff but
// drops thin bright strokes like lettering and ornaments. Returns the spine's
// average luminance so the overlaid title can pick a contrasting ink.
function blankSpine(ctx, { x, y, w, h, dir }) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const lines = dir === 'v' ? w : h;
  const len = dir === 'v' ? h : w;
  let lumSum = 0;
  for (let i = 0; i < lines; i++) {
    const r = [], g = [], b = [];
    for (let j = 0; j < len; j++) {
      const p = dir === 'v' ? (j * w + i) * 4 : (i * w + j) * 4;
      r.push(d[p]); g.push(d[p + 1]); b.push(d[p + 2]);
    }
    const mr = median(r), mg = median(g), mb = median(b);
    lumSum += 0.299 * mr + 0.587 * mg + 0.114 * mb;
    for (let j = 0; j < len; j++) {
      const p = dir === 'v' ? (j * w + i) * 4 : (i * w + j) * 4;
      d[p] = mr; d[p + 1] = mg; d[p + 2] = mb;
    }
  }
  ctx.putImageData(img, x, y);
  return lumSum / lines;
}

const pct = (v, total) => `${(v / total) * 100}%`;

// The library shelf: a bookshelf photo whose real spines are the places a
// book can stand. Empty places are blank spines; a placed book's title is
// lettered onto its spine.
export default function PhotoBookshelf({ books, selectedId, placing, dimmedIds, onSlotClick }) {
  const canvasRef = useRef(null);
  const [lums, setLums] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, SHELF_IMAGE_SIZE.w, SHELF_IMAGE_SIZE.h);
      setLums(SHELF_SLOTS.map((slot) => blankSpine(ctx, slot)));
    };
    img.src = shelfUrl;
    return () => { cancelled = true; };
  }, []);

  const bySlot = new Map(books.filter((b) => b.shelf_slot != null).map((b) => [b.shelf_slot, b]));
  const { w: W, h: H } = SHELF_IMAGE_SIZE;

  return (
    <div className={`reader-photo-shelf${placing ? ' placing' : ''}${lums ? ' ready' : ''}`}>
      <canvas ref={canvasRef} width={W} height={H} className="reader-photo-shelf-canvas" aria-hidden="true" />
      {SHELF_SLOTS.map((slot, i) => {
        const book = bySlot.get(i);
        const dark = lums ? lums[i] < 140 : true;
        // Title size follows the spine's thickness, in container-width units
        // so it scales with the photo.
        const thickness = slot.dir === 'v' ? slot.w : slot.h;
        const fontSize = `${Math.min(2.2, (thickness / W) * 100 * 0.42)}cqw`;
        const cls = [
          'reader-photo-slot',
          slot.dir === 'v' ? 'vertical' : 'horizontal',
          book ? 'occupied' : 'empty',
          dark ? 'ink-light' : 'ink-dark',
          book && book.id === selectedId ? 'selected' : '',
          book && dimmedIds?.has(book.id) ? 'dimmed' : '',
        ].filter(Boolean).join(' ');
        return (
          <button
            key={i}
            type="button"
            className={cls}
            style={{ left: pct(slot.x, W), top: pct(slot.y, H), width: pct(slot.w, W), height: pct(slot.h, H) }}
            onClick={() => onSlotClick(i, book || null)}
            aria-label={book ? book.title : `Свободное место ${i + 1}`}
            title={book ? book.title : 'Свободное место'}
          >
            {book
              ? <span className="reader-photo-slot-title" style={{ fontSize }}>{book.title}</span>
              : <span className="reader-photo-slot-plus"><Plus size={16} /></span>}
          </button>
        );
      })}
    </div>
  );
}
