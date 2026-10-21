import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkMinus, Check, ChevronLeft, ChevronRight, Copy, NotebookPen, Pause, Play, Quote, Share2, Trash2 } from 'lucide-react';
import * as api from '../lib/api';

// Highlight palette, as in the selection menu: soft tints that keep text
// readable on the page.
const COLORS = ['#D3D3DB', '#D9B8F5', '#BDBDEB', '#F5D9A8', '#BEEBF5', '#F2B49E', '#BDBDBD', '#A6D9AE'];
const MENU_W = 360;
const FLIP_MS = 800; // keep in sync with --flip-dur in reader.css
// Auto page-turning: seconds per page, remembered per device.
const AUTO_KEY = 'forge:reader-auto-seconds';
const AUTO_SPEEDS = [10, 15, 20, 30, 45, 60, 90, 120];
function loadAutoSeconds() {
  try { const v = Number(localStorage.getItem(AUTO_KEY)); return AUTO_SPEEDS.includes(v) ? v : 30; } catch { return 30; }
}

// Character offset of (node, offset) from the start of paragraph element `p`.
function offsetIn(p, node, offset) {
  const r = document.createRange();
  r.setStart(p, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

// The text node and offset holding character `idx` of element `root`.
function charAt(root, idx) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (idx < node.length) return [node, idx];
    idx -= node.length;
  }
  return null;
}
function charRect(root, idx) {
  const at = charAt(root, idx);
  if (!at) return null;
  const r = document.createRange();
  r.setStart(at[0], at[1]);
  r.setEnd(at[0], at[1] + 1);
  return r.getClientRects()[0] || r.getBoundingClientRect();
}

// Splits a paragraph into runs, each covered by the most recent highlight
// overlapping it (or none).
function segments(text, pos, highlights) {
  const hs = highlights.filter((h) => h.start_para <= pos && h.end_para >= pos);
  if (!hs.length) return [{ text, h: null }];
  const span = (h) => [h.start_para === pos ? h.start_offset : 0, h.end_para === pos ? h.end_offset : text.length];
  const cuts = new Set([0, text.length]);
  for (const h of hs) for (const c of span(h)) cuts.add(Math.min(Math.max(c, 0), text.length));
  const points = [...cuts].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a === b) continue;
    let top = null;
    for (const h of hs) {
      const [s, e] = span(h);
      if (s <= a && e >= b && (!top || h.created_at > top.created_at)) top = h;
    }
    out.push({ text: text.slice(a, b), h: top });
  }
  return out;
}

// "Читалка" mode: the original book (no translation) laid out as pages
// like an e-reader — CSS columns, one page-sized column in view at a time —
// flipped with an animated page turn (buttons, arrow keys, swipes) or
// automatically at a chosen speed. Highlights in colours, notes, bookmarks
// and a selection menu (colours / note / bookmark / copy / share / quote /
// delete); bookmarks and notes are listed in a sticky side panel.
export default function PlainReader({ book, textStyle, onProgress, onPosition, onSaveQuote }) {
  const [paragraphs, setParagraphs] = useState(null);
  const [error, setError] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [menu, setMenu] = useState(null); // { range | highlight, top, left }
  const [noteDraft, setNoteDraft] = useState(null); // string while editing a note
  const [toast, setToast] = useState(null);
  const articleRef = useRef(null); // the column flow holding the book
  const pageRef = useRef(null); // the page viewport
  const flipLayerRef = useRef(null);
  const castRef = useRef(null); // shadow the turning sheet casts on the page below
  const menuRef = useRef(null);
  // Pagination: geometry of the column flow and each paragraph's first page.
  const [layout, setLayout] = useState(null); // { step, pageCount, startPages }
  const [page, setPage] = useState(0);
  const pageStateRef = useRef({ page: 0, anchor: book.current_paragraph });
  const flippingRef = useRef(false);
  const [autoOn, setAutoOn] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState(loadAutoSeconds);
  // Side panel: this page's bookmarks/notes/highlights, or all of the book's.
  const [showAllMarks, setShowAllMarks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getBookText(book.id), api.listHighlights(book.id), api.listBookmarks(book.id)])
      .then(([text, hs, bms]) => {
        if (cancelled) return;
        setParagraphs(text.paragraphs);
        setHighlights(hs);
        setBookmarks(bms);
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [book.id]);

  // Lays the book out into pages and keeps the reader on the same paragraph
  // (the "anchor") across re-layouts: resize, font changes, webfont load.
  const relayout = useCallback(() => {
    const flow = articleRef.current;
    if (!flow) return;
    // Fractional width: a rounded clientWidth makes every page turn drift a
    // little, which adds up to whole lines cut off deep into a long book.
    const width = flow.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(flow).columnGap) || 0;
    const step = width + gap;
    if (!width) return;
    const prev = flow.style.transform;
    flow.style.transform = 'none';
    const origin = flow.getBoundingClientRect().left;
    const pageCount = Math.max(1, Math.round((flow.scrollWidth + gap) / step));
    const startPages = [...flow.querySelectorAll('[data-pos]')].map((el) => Math.floor((el.getBoundingClientRect().left - origin + 1) / step));
    flow.style.transform = prev;
    setLayout({ step, pageCount, startPages });
    const anchor = Math.min(pageStateRef.current.anchor, startPages.length - 1);
    const next = Math.min(pageCount - 1, Math.max(0, startPages[anchor] ?? 0));
    pageStateRef.current.page = next;
    setPage(next);
  }, []);

  useLayoutEffect(() => {
    if (!paragraphs) return undefined;
    relayout();
    const ro = new ResizeObserver(() => relayout());
    if (pageRef.current) ro.observe(pageRef.current);
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) relayout(); });
    return () => { cancelled = true; ro.disconnect(); };
  }, [paragraphs, relayout, textStyle.fontSize, textStyle.fontFamily]);

  // Paragraph a page is "at": the first one starting on it, or — if none
  // does — the one running across it. Re-opening (or re-laying out) goes to
  // that paragraph's first page, i.e. back to this same page.
  const paraAtPage = useCallback((pg) => {
    const sp = layout?.startPages || [];
    let lo = 0, hi = sp.length - 1, first = sp.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sp[mid] >= pg) { first = mid; hi = mid - 1; } else lo = mid + 1;
    }
    const idx = first < sp.length && sp[first] === pg ? first : Math.max(0, first - 1);
    return paragraphs?.[idx]?.position ?? 0;
  }, [layout, paragraphs]);

  // Reading position follows the page; saved shortly after the last turn
  // (and right away when leaving the mode or the page).
  const saveRef = useRef({ timer: null, pending: null });
  useEffect(() => {
    if (!layout) return;
    const pos = paraAtPage(page);
    pageStateRef.current = { page, anchor: pos };
    onPosition(pos);
    const sv = saveRef.current;
    sv.pending = pos;
    clearTimeout(sv.timer);
    sv.timer = setTimeout(() => { onProgress(book.id, pos); sv.pending = null; }, 800);
  }, [page, layout, paraAtPage, onPosition, onProgress, book.id]);
  useEffect(() => () => {
    const sv = saveRef.current;
    clearTimeout(sv.timer);
    if (sv.pending != null) onProgress(book.id, sv.pending);
  }, [book.id, onProgress]);

  // Page turn, like a real leaf: a two-sided sheet turns over 180° around the
  // spine (left edge). Its front is a snapshot of a page, its back is plain
  // paper; each side darkens as it
  // tilts away from the light, and the sheet casts a shadow on the page under
  // it. Forward, the current page lifts off and the next one is underneath;
  // back, the previous page comes in from the left and settles on top.
  const turnTo = useCallback((target) => {
    if (!layout || flippingRef.current) return;
    const to = Math.min(layout.pageCount - 1, Math.max(0, target));
    const from = pageStateRef.current.page;
    if (to === from) return;
    pageStateRef.current.page = to;
    const flow = articleRef.current;
    const layer = flipLayerRef.current;
    if (!flow || !layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPage(to);
      return;
    }
    const forward = to > from;
    // A copy of just what's on page `pg`, laid out as a single column: only
    // the paragraphs with a fragment on that page, the first one shifted up
    // by the part of it that's on earlier pages, clipped at the page's last
    // line. (Cloning the whole book's flow instead means laying out the
    // entire book again — a visible stall on long books.)
    const snapshot = (pg) => {
      const { step } = layout;
      const flowRect = flow.getBoundingClientRect();
      const colLeft = flowRect.left + pg * step;
      const onPage = (r) => r.left >= colLeft - 1 && r.left < colLeft + step - 1;
      const els = flow.querySelectorAll('[data-pos]');
      // Paragraph starts only move right through the book, so binary-search
      // (on the live layout) for the last one starting before this page — it
      // may run onto it — then take everything starting on it.
      const startLeft = (i) => els[i].getBoundingClientRect().left;
      let lo = 0, hi = els.length - 1, first = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (startLeft(mid) < colLeft - 1) { first = mid; lo = mid + 1; } else hi = mid - 1;
      }
      // First char of paragraph el laid out at or after x (binary search;
      // characters only move right through the columns).
      const firstCharFrom = (el, x) => {
        const len = el.textContent.length;
        let lo2 = 0, hi2 = len - 1, found = len;
        while (lo2 <= hi2) {
          const m = (lo2 + hi2) >> 1;
          const r = charRect(el, m);
          if (r && r.left >= x - 1) { found = m; hi2 = m - 1; } else lo2 = m + 1;
        }
        return found;
      };
      const parts = [];
      let firstEl = null;
      let lastEl = null;
      for (let i = first; i < els.length && startLeft(i) < colLeft + step - 1; i++) {
        if (![...els[i].getClientRects()].some(onPage)) continue;
        if (!firstEl) firstEl = els[i];
        lastEl = els[i];
        parts.push(els[i].cloneNode(true));
      }
      // The page's first character and its last line, measured on the live
      // page. (Fragment boxes can't be used: a paragraph's fragment runs to
      // the column's foot even when widows/orphans pushed its last lines on.)
      const topIdx = firstEl ? firstCharFrom(firstEl, colLeft) : 0;
      const topRect = firstEl && charRect(firstEl, topIdx);
      const liveTop = topRect ? topRect.top - flowRect.top : 0;
      let bottom = 0;
      if (lastEl) {
        const endIdx = firstCharFrom(lastEl, colLeft + step) - 1;
        const r = endIdx >= 0 && charRect(lastEl, endIdx);
        if (r) bottom = r.bottom - flowRect.top;
      }
      const snap = document.createElement('div');
      snap.className = 'reader-flip-snap';
      snap.lang = flow.lang;
      snap.style.cssText = flow.style.cssText;
      snap.style.transform = 'none';
      snap.style.width = `${flow.getBoundingClientRect().width}px`;
      snap.style.height = `${Math.ceil(bottom)}px`;
      const inner = document.createElement('div');
      for (const part of parts) inner.appendChild(part);
      snap.appendChild(inner);
      // Once in the document: move the copy so the page's first character
      // lands exactly where it is on the live page.
      // (Not snap.align: <div> already has a legacy string "align" property.)
      const alignToPage = () => {
        if (!inner.firstChild || !topRect) return;
        const r = charRect(inner.firstChild, topIdx);
        if (r) inner.style.marginTop = `${liveTop - (r.top - inner.getBoundingClientRect().top)}px`;
      };
      return { snap, alignToPage };
    };
    const face = (side, pg) => {
      const el = document.createElement('div');
      el.className = `reader-flip-face ${side}`;
      // Only the front carries the text: cloning the book's flow is the
      // costly part, so the back is plain paper.
      if (pg != null) {
        const shot = snapshot(pg);
        el.appendChild(shot.snap);
        el.alignToPage = shot.alignToPage;
      }
      const shade = document.createElement('div');
      shade.className = 'reader-flip-shade';
      el.appendChild(shade);
      return el;
    };
    // The leaf carries the page that moves: the one being left (forward) or
    // the one being returned to (back).
    const leafPage = forward ? from : to;
    const sheet = document.createElement('div');
    sheet.className = `reader-flip-sheet ${forward ? 'next' : 'prev'}`;
    const front = face('front', leafPage);
    sheet.appendChild(front);
    sheet.appendChild(face('back', null));
    layer.appendChild(sheet);
    front.alignToPage();
    const cast = castRef.current;
    if (cast) {
      cast.className = 'reader-flip-cast';
      void cast.offsetWidth; // restart the animation
      cast.classList.add(forward ? 'next' : 'prev');
    }
    flippingRef.current = true;
    // Forward: the next page is already underneath. Back: the old page stays
    // put until the returning leaf has fully covered it.
    if (forward) setPage(to);
    setTimeout(() => {
      if (!forward) setPage(to);
      // Drop the leaf only after the page under it has re-rendered. (A timer,
      // not requestAnimationFrame: rAF pauses in background tabs and would
      // leave the reader locked mid-turn.)
      setTimeout(() => {
        sheet.remove();
        if (cast) cast.className = 'reader-flip-cast';
        flippingRef.current = false;
      }, 50);
    }, FLIP_MS);
  }, [layout]);

  // All pages a list item shows up on: for a highlight every page its marked
  // text touches (it can run over a page break), for a bookmark the page its
  // paragraph — and the ribbon — starts on.
  const itemPages = (kind, item) => {
    if (!layout) return [0];
    const flow = articleRef.current;
    if (kind === 'highlight' && flow) {
      const origin = flow.getBoundingClientRect().left;
      const pages = new Set();
      for (const mark of flow.querySelectorAll(`mark[data-hid="${item.id}"]`)) {
        for (const r of mark.getClientRects()) pages.add(Math.floor((r.left - origin + 1) / layout.step));
      }
      if (pages.size) return [...pages].sort((a, b) => a - b);
    }
    const pos = kind === 'highlight' ? item.start_para : item.paragraph;
    return [layout.startPages[paragraphs.findIndex((x) => x.position === pos)] ?? 0];
  };

  // Briefly pulse an item in the text so it's easy to spot on the page.
  const flash = (kind, item) => {
    const flow = articleRef.current;
    if (!flow) return;
    const els = kind === 'highlight'
      ? flow.querySelectorAll(`mark[data-hid="${item.id}"]`)
      : flow.querySelectorAll(`[data-pos="${item.paragraph}"]`);
    for (const el of els) {
      el.classList.remove('reader-flash');
      void el.offsetWidth; // restart the animation
      el.classList.add('reader-flash');
      setTimeout(() => el.classList.remove('reader-flash'), 1400);
    }
  };

  const openItem = (kind, item, pages) => {
    if (!pages.includes(page)) turnTo(pages[0]);
    setTimeout(() => flash(kind, item), pages.includes(page) ? 0 : FLIP_MS);
  };

  // Arrow keys / PageUp / PageDown / space turn pages (not while typing).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); turnTo(pageStateRef.current.page + 1); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); turnTo(pageStateRef.current.page - 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [turnTo]);

  // Horizontal swipe on the page turns it (unless it ended a text selection).
  const touchRef = useRef(null);
  const onTouchStart = (e) => { const t = e.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || window.getSelection()?.toString().trim()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turnTo(pageStateRef.current.page + (dx < 0 ? 1 : -1));
  };

  const changeAutoSeconds = (sec) => {
    setAutoSeconds(sec);
    try { localStorage.setItem(AUTO_KEY, String(sec)); } catch { /* private mode */ }
  };
  const lastPage = layout ? layout.pageCount - 1 : 0;
  // The pacer bar fills over autoSeconds, then the page turns; it pauses while
  // the selection menu is open, and stops on the last page.
  const onPacerEnd = () => {
    if (page >= lastPage) setAutoOn(false);
    else turnTo(page + 1);
  };

  const placeMenu = (rect) => {
    const vw = document.documentElement.clientWidth;
    const width = Math.min(MENU_W, vw - 16);
    return {
      width,
      top: rect.bottom + window.scrollY + 10,
      left: Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), vw - width - 8) + window.scrollX,
    };
  };

  // New selection -> menu for it (debounced so it settles, incl. touch handles).
  useEffect(() => {
    let timer = null;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = window.getSelection();
        if (!s || s.isCollapsed || s.rangeCount === 0) return;
        const range = s.getRangeAt(0);
        const article = articleRef.current;
        if (!article || !article.contains(range.commonAncestorContainer)) return;
        const startP = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement).closest('[data-pos]');
        const endP = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement).closest('[data-pos]');
        if (!startP || !endP) return;
        const text = s.toString().replace(/\s+/g, ' ').trim();
        if (!text) return;
        setNoteDraft(null);
        setMenu({
          range: {
            start_para: Number(startP.dataset.pos),
            start_offset: offsetIn(startP, range.startContainer, range.startOffset),
            end_para: Number(endP.dataset.pos),
            end_offset: offsetIn(endP, range.endContainer, range.endOffset),
            text,
          },
          ...placeMenu(range.getBoundingClientRect()),
        });
      }, 350);
    };
    document.addEventListener('selectionchange', onChange);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', onChange); };
  }, []);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || pageRef.current?.contains(e.target)) return;
      setMenu(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Taps on highlights are caught here (delegated) so the memoized book body
  // below carries no per-render handlers.
  const onArticleClick = (e) => {
    const mark = e.target.closest?.('mark[data-hid]');
    if (!mark) return;
    if (window.getSelection()?.toString().trim()) return; // finishing a drag, not a tap
    const h = highlights.find((x) => x.id === mark.dataset.hid);
    if (!h) return;
    setNoteDraft(null);
    setMenu({ highlight: h, ...placeMenu(mark.getBoundingClientRect()) });
  };

  const closeMenu = () => {
    setMenu(null);
    setNoteDraft(null);
    window.getSelection()?.removeAllRanges();
  };

  const current = menu?.highlight || menu?.range;
  const menuText = current?.text || '';
  const menuPara = current?.start_para;
  const bookmarkHere = menu ? bookmarks.find((b) => b.paragraph === menuPara) : null;

  // Colour (or note) on a fresh selection creates the highlight; on an
  // existing one it updates it. The menu then stays on that highlight.
  const setColor = async (color) => {
    try {
      if (menu.highlight) {
        const h = await api.updateHighlight(menu.highlight.id, { color });
        setHighlights((prev) => prev.map((x) => (x.id === h.id ? h : x)));
        setMenu((m) => ({ ...m, highlight: h }));
      } else {
        const h = await api.createHighlight({ book_id: book.id, ...menu.range, color });
        setHighlights((prev) => [...prev, h]);
        window.getSelection()?.removeAllRanges();
        setMenu((m) => ({ highlight: h, top: m.top, left: m.left, width: m.width }));
      }
    } catch (err) { setToast(err.message); }
  };

  const saveNote = async () => {
    const note = (noteDraft || '').trim() || null;
    try {
      if (menu.highlight) {
        const h = await api.updateHighlight(menu.highlight.id, { note });
        setHighlights((prev) => prev.map((x) => (x.id === h.id ? h : x)));
      } else {
        const h = await api.createHighlight({ book_id: book.id, ...menu.range, color: COLORS[0], note });
        setHighlights((prev) => [...prev, h]);
      }
      setToast('Заметка сохранена');
      closeMenu();
    } catch (err) { setToast(err.message); }
  };

  const toggleBookmark = async () => {
    try {
      if (bookmarkHere) {
        await api.deleteBookmark(bookmarkHere.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkHere.id));
        setToast('Закладка убрана');
      } else {
        const para = paragraphs.find((p) => p.position === menuPara);
        const b = await api.createBookmark({ book_id: book.id, paragraph: menuPara, snippet: para?.text.slice(0, 160) });
        setBookmarks((prev) => [...prev.filter((x) => x.paragraph !== b.paragraph), b].sort((x, y) => x.paragraph - y.paragraph));
        setToast('Закладка поставлена');
      }
      closeMenu();
    } catch (err) { setToast(err.message); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(menuText); setToast('Скопировано'); } catch { setToast('Не удалось скопировать'); }
    closeMenu();
  };

  const share = async () => {
    const text = `${menuText}\n— ${[book.author, `«${book.title}»`].filter(Boolean).join(', ')}`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(text); setToast('Скопировано — можно вставить куда угодно'); } catch { setToast('Не удалось поделиться'); }
    }
    closeMenu();
  };

  const toQuote = async () => {
    try {
      await onSaveQuote({ text: menuText, author: book.author || '', bookId: book.id });
      setToast('Цитата сохранена — она в рамке на полке');
    } catch (err) { setToast(err.message); }
    closeMenu();
  };

  const removeHighlight = async () => {
    const h = menu.highlight;
    setHighlights((prev) => prev.filter((x) => x.id !== h.id));
    closeMenu();
    try { await api.deleteHighlight(h.id); } catch (err) { setToast(err.message); }
  };

  const bookmarked = useMemo(() => new Set(bookmarks.map((b) => b.paragraph)), [bookmarks]);
  const listItems = useMemo(() => [
    ...bookmarks.map((b) => ({ kind: 'bookmark', pos: b.paragraph, item: b })),
    ...highlights.map((h) => ({ kind: 'highlight', pos: h.start_para, item: h })),
  ].sort((a, b) => a.pos - b.pos), [bookmarks, highlights]);

  // The whole book can be ~1000 paragraphs; only re-render it when its
  // text, highlights or bookmarks change — not on every scroll/menu update.
  const body = useMemo(() => (paragraphs || []).map((p) => (
    <p key={p.position} data-pos={p.position} className={`reader-plain-p${bookmarked.has(p.position) ? ' bookmarked' : ''}`}>
      {segments(p.text, p.position, highlights).map((seg, i) => (seg.h ? (
        <mark
          key={i}
          data-hid={seg.h.id}
          className={`reader-hl${seg.h.note ? ' has-note' : ''}`}
          style={{ background: seg.h.color || COLORS[0] }}
          title={seg.h.note || undefined}
        >
          {seg.text}
        </mark>
      ) : (
        <span key={i}>{seg.text}</span>
      )))}
    </p>
  )), [paragraphs, highlights, bookmarked]);

  if (error) return <div className="reader-error">Не удалось загрузить текст: {error}</div>;
  if (!paragraphs) return <div className="reader-loading">Загрузка книги…</div>;

  const activeColor = menu?.highlight?.color;
  const withPages = listItems.map((x) => ({ ...x, pages: itemPages(x.kind, x.item) }));
  const shownItems = showAllMarks ? withPages : withPages.filter((x) => x.pages.includes(page));

  return (
    <div className="reader-plain-layout">
      <div className="reader-plain-main">
        <div className="reader-plain-stage">
        <div
          ref={pageRef}
          className="reader-plain-page"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <article
            ref={articleRef}
            className="reader-plain"
            style={{ ...textStyle, transform: layout ? `translateX(${-page * layout.step}px)` : undefined }}
            lang={book.source_lang}
            onClick={onArticleClick}
          >
            {body}
          </article>
          <div ref={castRef} className="reader-flip-cast" aria-hidden="true" />
          <button type="button" className="reader-page-edge left" onClick={() => turnTo(page - 1)} disabled={page <= 0} aria-label="Предыдущая страница">
            <ChevronLeft size={22} />
          </button>
          <button type="button" className="reader-page-edge right" onClick={() => turnTo(page + 1)} disabled={page >= lastPage} aria-label="Следующая страница">
            <ChevronRight size={22} />
          </button>
          {autoOn && (
            <div
              key={`${page}-${autoSeconds}`}
              className="reader-pacer"
              style={{ animationDuration: `${autoSeconds}s`, animationPlayState: menu ? 'paused' : 'running' }}
              onAnimationEnd={onPacerEnd}
            />
          )}
        </div>
        <div ref={flipLayerRef} className="reader-flip-layer" aria-hidden="true" />
        </div>

        <div className="reader-plain-controls">
          <button type="button" className="reader-nav-btn" onClick={() => turnTo(page - 1)} disabled={page <= 0} aria-label="Назад">
            <ChevronLeft size={18} />
          </button>
          <span className="reader-plain-pageno">{layout ? `стр. ${page + 1} из ${layout.pageCount}` : '…'}</span>
          <button type="button" className="reader-nav-btn" onClick={() => turnTo(page + 1)} disabled={page >= lastPage} aria-label="Вперёд">
            <ChevronRight size={18} />
          </button>
          <span className="reader-toolbar-sep" />
          <button
            type="button"
            className={`reader-auto-btn${autoOn ? ' active' : ''}`}
            onClick={() => setAutoOn((on) => !on)}
            disabled={page >= lastPage && !autoOn}
            title="Автоматически перелистывать страницы"
          >
            {autoOn ? <Pause size={16} /> : <Play size={16} />} Автолистание
          </button>
          <label className="reader-auto-speed">
            <span>Скорость</span>
            <select value={autoSeconds} onChange={(e) => changeAutoSeconds(Number(e.target.value))} aria-label="Секунд на страницу">
              {AUTO_SPEEDS.map((sec) => <option key={sec} value={sec}>{sec} с / стр.</option>)}
            </select>
          </label>
        </div>
      </div>

      <aside className="reader-plain-aside" aria-label="Закладки и заметки">
        <div className="reader-plain-aside-head">
          <Bookmark size={15} /> {showAllMarks ? 'Все отметки в книге' : 'На этой странице'}
          {shownItems.length > 0 && <span className="reader-plain-aside-count">{shownItems.length}</span>}
        </div>
        <div className="reader-plain-list">
          {shownItems.length === 0 && (
            <div className="reader-shelf-panel-sub">
              {listItems.length === 0 || showAllMarks
                ? 'Пока пусто. Выделите текст, чтобы отметить его цветом, оставить заметку или поставить закладку.'
                : 'На этой странице отметок нет. Выделите текст, чтобы отметить его цветом, оставить заметку или поставить закладку.'}
            </div>
          )}
          {shownItems.map(({ kind, item, pages }) => (
            <button key={`${kind}-${item.id}`} type="button" className="reader-plain-list-item" onClick={() => openItem(kind, item, pages)}>
              {kind === 'bookmark'
                ? <Bookmark size={15} className="reader-plain-list-icon" />
                : <span className="reader-plain-list-dot" style={{ background: item.color || COLORS[0] }} />}
              <span className="reader-plain-list-main">
                <span className="reader-plain-list-text">{kind === 'bookmark' ? item.snippet : item.text}</span>
                {kind === 'highlight' && item.note && <span className="reader-plain-list-note">{item.note}</span>}
              </span>
              {layout && showAllMarks && <span className="reader-plain-list-pos">стр. {pages[0] + 1}</span>}
            </button>
          ))}
        </div>
        {listItems.length > 0 && (
          <button type="button" className="reader-plain-aside-toggle" onClick={() => setShowAllMarks((v) => !v)}>
            {showAllMarks ? 'Только эта страница' : `Все отметки в книге (${listItems.length})`}
          </button>
        )}
      </aside>

      {menu && createPortal(
        <div ref={menuRef} className="reader-hl-menu" style={{ top: menu.top, left: menu.left, width: menu.width }} role="dialog" aria-label="Действия с фрагментом">
          <div className="reader-hl-colors">
            <div className="reader-hl-swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`reader-hl-swatch${activeColor === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label="Выделить цветом"
                >
                  {activeColor === c && <Check size={16} />}
                </button>
              ))}
            </div>
            <button type="button" className="reader-hl-done" onClick={closeMenu} aria-label="Готово"><Check size={22} /></button>
          </div>

          {noteDraft != null ? (
            <div className="reader-hl-note">
              <textarea
                className="reader-quote-input"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Заметка к фрагменту…"
                rows={3}
                autoFocus
              />
              <div className="reader-quote-actions">
                <button type="button" className="reader-btn-solid reader-btn-coral" onClick={saveNote}>Сохранить</button>
                <button type="button" className="reader-btn-ghost" onClick={() => setNoteDraft(null)}>Отмена</button>
              </div>
            </div>
          ) : (
            <div className="reader-hl-items">
              <button type="button" className="reader-hl-item" onClick={() => setNoteDraft(menu.highlight?.note || '')}>
                <NotebookPen size={18} /> {menu.highlight?.note ? 'Редактировать заметку' : 'Добавить заметку'}
              </button>
              <button type="button" className="reader-hl-item" onClick={toggleBookmark}>
                {bookmarkHere ? <BookmarkMinus size={18} /> : <Bookmark size={18} />} {bookmarkHere ? 'Убрать закладку' : 'Поставить закладку'}
              </button>
              <button type="button" className="reader-hl-item" onClick={copy}><Copy size={18} /> Скопировать</button>
              <button type="button" className="reader-hl-item" onClick={share}><Share2 size={18} /> Поделиться</button>
              <button type="button" className="reader-hl-item" onClick={toQuote}><Quote size={18} /> В цитаты</button>
              {menu.highlight && (
                <button type="button" className="reader-hl-item danger" onClick={removeHighlight}><Trash2 size={18} /> Удалить</button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}

      {toast && createPortal(<div className="reader-toast" role="status">{toast}</div>, document.body)}
    </div>
  );
}
