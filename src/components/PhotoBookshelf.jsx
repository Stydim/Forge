import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import shelfUrl from '../assets/bookshelf.jpg';
import { QUOTE_FRAME, SHELF_IMAGE_SIZE, SHELF_SLOTS } from '../lib/bookshelf';
import FittedQuote from './FittedQuote';

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

// Paints out the framed print's text inside its (slightly turned) paper quad.
// Same per-column median as the spines, but only for pixels inside the quad,
// blended in over the last few pixels before its edges so no hard seam shows
// where the cleaned paper meets the untouched rim next to the frame.
function blankPaper(ctx, quad, feather = 8) {
  const xs = quad.map((q) => q[0]);
  const ys = quad.map((q) => q[1]);
  const x0 = Math.floor(Math.min(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const w = Math.ceil(Math.max(...xs)) - x0;
  const h = Math.ceil(Math.max(...ys)) - y0;
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  // Corners go clockwise on screen, so each edge's inward normal is (-dy, dx).
  const edges = quad.map((a, i) => {
    const b = quad[(i + 1) % quad.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { ax: a[0], ay: a[1], nx: -(b[1] - a[1]) / len, ny: (b[0] - a[0]) / len };
  });
  const depth = (px, py) => Math.min(...edges.map((e) => (px - e.ax) * e.nx + (py - e.ay) * e.ny));
  for (let i = 0; i < w; i++) {
    const r = [], g = [], b = [], rows = [];
    for (let j = 0; j < h; j++) {
      const dist = depth(x0 + i + 0.5, y0 + j + 0.5);
      if (dist <= 0) continue;
      const p = (j * w + i) * 4;
      r.push(d[p]); g.push(d[p + 1]); b.push(d[p + 2]);
      rows.push([p, Math.min(1, dist / feather)]);
    }
    if (!rows.length) continue;
    const mr = median(r), mg = median(g), mb = median(b);
    for (const [p, t] of rows) {
      d[p] += (mr - d[p]) * t;
      d[p + 1] += (mg - d[p + 1]) * t;
      d[p + 2] += (mb - d[p + 2]) * t;
    }
  }
  ctx.putImageData(img, x0, y0);
}

const pct = (v, total) => `${(v / total) * 100}%`;

const PAPER_BOUNDS = (() => {
  const xs = QUOTE_FRAME.paper.map((q) => q[0]);
  const ys = QUOTE_FRAME.paper.map((q) => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
})();

// Spine lettering: uppercase Playfair with 0.04em tracking (see reader.css).
const TITLE_FONT = "600 100px 'Playfair Display', Georgia, serif";
const LINE_HEIGHT = 1.15;
const MIN_TITLE_PX = 9; // in photo pixels; anything longer gets ellipsized
let measureCtx = null;
function textWidth100(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = TITLE_FONT;
  return measureCtx.measureText(text).width + text.length * 4;
}

// Splits words into n lines with the narrowest widest line (titles are a
// handful of words, so trying every split is cheap).
function splitLines(words, n) {
  if (n === 1) return { lines: [words.join(' ')], widest: textWidth100(words.join(' ')) };
  let best = null;
  for (let i = 1; i <= words.length - n + 1; i++) {
    const head = words.slice(0, i).join(' ');
    const rest = splitLines(words.slice(i), n - 1);
    const widest = Math.max(textWidth100(head), rest.widest);
    if (!best || widest < best.widest) best = { lines: [head, ...rest.lines], widest };
  }
  return best;
}

// Picks the line count and font size (in photo pixels) that make the title
// as large as possible while fitting along the spine and across its width.
function fitTitle(title, slot) {
  const text = title.toUpperCase().trim();
  const length = (slot.dir === 'v' ? slot.h : slot.w) * 0.86;
  const thickness = slot.dir === 'v' ? slot.w : slot.h;
  const words = text.split(/\s+/).filter(Boolean);
  let best = { lines: [text], size: 0 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const { lines, widest } = splitLines(words, n);
    const across = n === 1 ? thickness * 0.6 : (thickness * 0.86) / (n * LINE_HEIGHT);
    const size = Math.min(across, (length * 100) / widest);
    // Extra lines only when they make the title clearly bigger.
    if (size > best.size * 1.05) best = { lines, size };
  }
  return { lines: best.lines, size: Math.max(MIN_TITLE_PX, best.size) };
}

// The library shelf: a bookshelf photo whose real spines are the places a
// book can stand. Empty places are blank spines; a placed book's title is
// lettered onto its spine. The framed print shows the pinned quote. `menu`
// opens in a popover beside `menuSlot` — a spine index, or 'frame'.
export default function PhotoBookshelf({ books, selectedId, placing, dimmedIds, onSlotClick, quote, onFrameClick, menuSlot, menu, onMenuClose }) {
  const canvasRef = useRef(null);
  const popoverRef = useRef(null);
  const [lums, setLums] = useState(null);
  // Title fitting measures text in the real webfont, so redo it once loaded.
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, SHELF_IMAGE_SIZE.w, SHELF_IMAGE_SIZE.h);
      // The print's paper: per-column medians keep its light falloff and
      // drop the printed lines of text.
      blankPaper(ctx, QUOTE_FRAME.paper);
      setLums(SHELF_SLOTS.map((slot) => blankSpine(ctx, slot)));
    };
    img.src = shelfUrl;
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const done = () => { if (!cancelled) setFontsReady(true); };
    if (document.fonts) document.fonts.load(TITLE_FONT).then(done, done);
    else done();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (menuSlot == null) return undefined;
    const onDown = (e) => { if (!popoverRef.current?.contains(e.target)) onMenuClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onMenuClose(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuSlot, onMenuClose]);

  // fitTitle sizes titles from canvas measurements, but phones can render
  // text bigger than asked (Android WebView's system font scale, browser
  // font boosting). So after layout, measure each title as actually rendered
  // and shrink it into its spine with a transform, which no text scaling
  // affects.
  const shelfRef = useRef(null);
  useLayoutEffect(() => {
    const root = shelfRef.current;
    if (!root) return undefined;
    const correct = () => {
      for (const title of root.querySelectorAll('.reader-photo-slot-title')) {
        title.style.transform = '';
        const slot = title.parentElement;
        const vertical = slot.classList.contains('vertical');
        let along = 0;
        for (const line of title.children) along = Math.max(along, vertical ? line.scrollHeight : line.scrollWidth);
        const across = vertical ? title.scrollWidth : title.scrollHeight;
        const k = Math.min(
          1,
          ((vertical ? slot.clientHeight : slot.clientWidth) * 0.9) / along,
          ((vertical ? slot.clientWidth : slot.clientHeight) * 0.92) / across
        );
        if (k < 1) title.style.transform = `scale(${k})`;
      }
    };
    correct();
    const ro = new ResizeObserver(correct);
    ro.observe(root);
    return () => ro.disconnect();
  });

  const { w: W, h: H } = SHELF_IMAGE_SIZE;
  const fits = useMemo(() => {
    const map = new Map();
    for (const b of books) {
      if (b.shelf_slot != null && SHELF_SLOTS[b.shelf_slot]) map.set(b.shelf_slot, { book: b, ...fitTitle(b.title, SHELF_SLOTS[b.shelf_slot]) });
    }
    return map;
    // fontsReady only re-triggers measuring once the webfont is in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, fontsReady]);

  // The popover opens beside the clicked spine, on whichever side has room,
  // aligned to its top (upper half of the photo) or bottom (lower half).
  let popoverStyle = null;
  if (menuSlot != null) {
    const s = menuSlot === 'frame' ? PAPER_BOUNDS : SHELF_SLOTS[menuSlot];
    popoverStyle = {};
    if (s.x + s.w / 2 < W * 0.55) popoverStyle.left = `calc(${pct(s.x + s.w, W)} + 10px)`;
    else popoverStyle.right = `calc(${pct(W - s.x, W)} + 10px)`;
    if (s.y + s.h / 2 < H / 2) popoverStyle.top = pct(s.y, H);
    else popoverStyle.bottom = pct(H - s.y - s.h, H);
  }

  return (
    <div ref={shelfRef} className={`reader-photo-shelf${placing ? ' placing' : ''}${lums ? ' ready' : ''}`}>
      <canvas ref={canvasRef} width={W} height={H} className="reader-photo-shelf-canvas" aria-hidden="true" />
      {SHELF_SLOTS.map((slot, i) => {
        const fit = fits.get(i);
        const book = fit?.book;
        const dark = lums ? lums[i] < 140 : true;
        const cls = [
          'reader-photo-slot',
          slot.dir === 'v' ? 'vertical' : 'horizontal',
          book ? 'occupied' : 'empty',
          dark ? 'ink-light' : 'ink-dark',
          book && book.id === selectedId ? 'selected' : '',
          book && dimmedIds?.has(book.id) ? 'dimmed' : '',
          menuSlot === i ? 'menu-open' : '',
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
            {book ? (
              // Sized in container-width units so it scales with the photo.
              <span className="reader-photo-slot-title" style={{ fontSize: `${(fit.size / W) * 100}cqw` }}>
                {fit.lines.map((line, k) => <span key={k} className="reader-photo-slot-line">{line}</span>)}
              </span>
            ) : (
              <span className="reader-photo-slot-plus"><Plus size={16} /></span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        className={`reader-photo-frame${menuSlot === 'frame' ? ' menu-open' : ''}`}
        style={{
          left: pct(QUOTE_FRAME.text.cx - QUOTE_FRAME.text.w / 2, W),
          top: pct(QUOTE_FRAME.text.cy - QUOTE_FRAME.text.h / 2, H),
          width: pct(QUOTE_FRAME.text.w, W),
          height: pct(QUOTE_FRAME.text.h, H),
          transform: `rotate(${QUOTE_FRAME.text.angle}deg)`,
        }}
        onClick={onFrameClick}
        aria-label="Цитата в рамке"
        title="Добавить цитату"
      >
        {lums && <FittedQuote quote={quote} />}
      </button>
      {menuSlot != null && (
        <div ref={popoverRef} className="reader-photo-popover" style={popoverStyle} role="dialog" aria-label={menuSlot === 'frame' ? 'Цитаты' : 'Свободное место'}>
          {menu}
        </div>
      )}
    </div>
  );
}
