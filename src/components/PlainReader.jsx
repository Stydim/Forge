import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkMinus, Check, Copy, NotebookPen, Pause, Play, Quote, Share2, Trash2 } from 'lucide-react';
import * as api from '../lib/api';

// Highlight palette, as in the selection menu: soft tints that keep text
// readable on the page.
const COLORS = ['#D3D3DB', '#D9B8F5', '#BDBDEB', '#F5D9A8', '#BEEBF5', '#F2B49E', '#BDBDBD', '#A6D9AE'];
const MENU_W = 360;
// Auto-scroll speed in pixels per second, remembered per device.
const AUTO_KEY = 'forge:reader-scroll-speed';
const AUTO_SPEEDS = [['Очень медленно', 12], ['Медленно', 20], ['Средне', 32], ['Быстро', 48], ['Очень быстро', 70]];
function loadAutoSpeed() {
  try { const v = Number(localStorage.getItem(AUTO_KEY)); return AUTO_SPEEDS.some(([, px]) => px === v) ? v : 20; } catch { return 20; }
}

// Character offset of (node, offset) from the start of paragraph element `p`.
function offsetIn(p, node, offset) {
  const r = document.createRange();
  r.setStart(p, 0);
  r.setEnd(node, offset);
  return r.toString().length;
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

// "Читалка" mode: the original book (no translation) as continuous text in a
// fixed-height window that scrolls smoothly — by wheel, touch, keys, or
// automatically at a chosen speed. Highlights in colours, notes, bookmarks
// and a selection menu (colours / note / bookmark / copy / share / quote /
// delete); the side panel lists the marks in the visible part of the text.
export default function PlainReader({ book, textStyle, onProgress, onPosition, onSaveQuote }) {
  const [paragraphs, setParagraphs] = useState(null);
  const [error, setError] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [menu, setMenu] = useState(null); // { range | highlight, top, left }
  const [noteDraft, setNoteDraft] = useState(null); // string while editing a note
  const [toast, setToast] = useState(null);
  const articleRef = useRef(null); // the book's text
  const viewRef = useRef(null); // the scrolling window around it
  const menuRef = useRef(null);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = !!menu;
  // Paragraph range currently in the window (for the side panel), and the
  // reading position = first paragraph visible at the top.
  const [visible, setVisible] = useState({ first: book.current_paragraph, last: book.current_paragraph });
  const anchorRef = useRef(book.current_paragraph);
  const [autoOn, setAutoOn] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(loadAutoSpeed);
  // Side panel: marks in view, or all of the book's.
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

  const paraEl = (pos) => articleRef.current?.querySelector(`[data-pos="${pos}"]`);

  // Puts paragraph `pos` at the top of the window.
  const scrollToPara = useCallback((pos, smooth) => {
    const view = viewRef.current;
    const el = articleRef.current?.querySelector(`[data-pos="${pos}"]`);
    if (!view || !el) return;
    view.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Open where the reader left off, and keep that paragraph at the top when
  // the font or its size changes.
  useLayoutEffect(() => {
    if (paragraphs) scrollToPara(anchorRef.current, false);
  }, [paragraphs, textStyle.fontSize, textStyle.fontFamily, scrollToPara]);

  // Track what's in the window: the paragraph at the top is the reading
  // position (saved shortly after scrolling settles, and right away on
  // leaving), and the visible range drives the side panel.
  const saveRef = useRef({ timer: null, pending: null });
  useEffect(() => {
    const view = viewRef.current;
    if (!paragraphs || !view) return undefined;
    const els = [...articleRef.current.querySelectorAll('[data-pos]')];
    const firstBelow = (y) => {
      let lo = 0, hi = els.length - 1, ans = els.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (els[mid].offsetTop + els[mid].offsetHeight > y) { ans = mid; hi = mid - 1; } else lo = mid + 1;
      }
      return ans;
    };
    let raf = 0;
    const measure = () => {
      raf = 0;
      if (!els.length) return;
      const top = view.scrollTop + 16;
      const fi = firstBelow(top);
      const li = firstBelow(view.scrollTop + view.clientHeight - 16);
      const first = Number(els[fi].dataset.pos);
      const last = Number(els[li].dataset.pos);
      setVisible((v) => (v.first === first && v.last === last ? v : { first, last }));
      if (anchorRef.current !== first) {
        anchorRef.current = first;
        onPosition(first);
        const sv = saveRef.current;
        sv.pending = first;
        clearTimeout(sv.timer);
        sv.timer = setTimeout(() => { onProgress(book.id, first); sv.pending = null; }, 1000);
      }
    };
    const onScroll = () => {
      // The selection menu sits at a fixed spot; scrolling the text away from
      // it closes it (auto-scroll is paused while it's open).
      if (menuOpenRef.current) setMenu(null);
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    view.addEventListener('scroll', onScroll, { passive: true });
    return () => { view.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [paragraphs, highlights, bookmarks, book.id, onPosition, onProgress]);
  useEffect(() => () => {
    const sv = saveRef.current;
    clearTimeout(sv.timer);
    if (sv.pending != null) onProgress(book.id, sv.pending);
  }, [book.id, onProgress]);

  // Keys scroll the window smoothly (not while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      const view = viewRef.current;
      if (!view || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const page = view.clientHeight * 0.85;
      const by = { ' ': page, PageDown: page, PageUp: -page, ArrowDown: 70, ArrowUp: -70 }[e.key];
      if (by == null) return;
      e.preventDefault();
      view.scrollBy({ top: e.shiftKey && e.key === ' ' ? -page : by, behavior: 'smooth' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Auto-scroll: moves the text up at autoSpeed px/s. It pauses while the
  // selection menu is open or text is selected, yields for a moment when the
  // reader scrolls or touches the text themself, and stops at the end.
  useEffect(() => {
    const view = viewRef.current;
    if (!autoOn || !view) return undefined;
    let raf = 0;
    let prev = performance.now();
    let pos = view.scrollTop;
    let expected = view.scrollTop;
    let holdUntil = 0;
    const hold = () => { holdUntil = performance.now() + 1500; };
    const tick = (now) => {
      const dt = Math.min(100, now - prev);
      prev = now;
      if (Math.abs(view.scrollTop - expected) > 2) { pos = view.scrollTop; hold(); } // reader scrolled
      const paused = now < holdUntil || menuOpenRef.current || !!window.getSelection()?.toString();
      if (!paused) {
        pos += (autoSpeed * dt) / 1000;
        view.scrollTop = pos;
        if (view.scrollTop + view.clientHeight >= view.scrollHeight - 1) { setAutoOn(false); return; }
      }
      expected = view.scrollTop;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    view.addEventListener('wheel', hold, { passive: true });
    view.addEventListener('touchstart', hold, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      view.removeEventListener('wheel', hold);
      view.removeEventListener('touchstart', hold);
    };
  }, [autoOn, autoSpeed]);

  const changeAutoSpeed = (px) => {
    setAutoSpeed(px);
    try { localStorage.setItem(AUTO_KEY, String(px)); } catch { /* private mode */ }
  };

  // Briefly pulse an item in the text so it's easy to spot.
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

  // Scrolls an item into the upper part of the window, then pulses it.
  const openItem = (kind, item) => {
    const view = viewRef.current;
    const target = kind === 'highlight'
      ? articleRef.current?.querySelector(`mark[data-hid="${item.id}"]`) || paraEl(item.start_para)
      : paraEl(item.paragraph);
    if (!view || !target) return;
    const delta = target.getBoundingClientRect().top - view.getBoundingClientRect().top;
    const inView = delta > 0 && delta < view.clientHeight - 40;
    if (!inView) view.scrollBy({ top: delta - view.clientHeight * 0.25, behavior: 'smooth' });
    setTimeout(() => flash(kind, item), inView ? 0 : 450);
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
      if (menuRef.current?.contains(e.target) || viewRef.current?.contains(e.target)) return;
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
  const inView = ({ kind, item }) => (kind === 'bookmark'
    ? item.paragraph >= visible.first && item.paragraph <= visible.last
    : item.start_para <= visible.last && item.end_para >= visible.first);
  const shownItems = showAllMarks ? listItems : listItems.filter(inView);
  const total = Math.max(1, paragraphs.length);
  const percentAt = (pos) => Math.min(100, Math.round((pos / total) * 100));

  return (
    <div className="reader-plain-layout">
      <div className="reader-plain-main">
        <div className="reader-plain-page">
          <div ref={viewRef} className="reader-plain-scroll">
          <article
            ref={articleRef}
            className="reader-plain"
            style={textStyle}
            lang={book.source_lang}
            onClick={onArticleClick}
          >
            {body}
          </article>
          </div>
        </div>

        <div className="reader-plain-controls">
          <button
            type="button"
            className={`reader-auto-btn${autoOn ? ' active' : ''}`}
            onClick={() => setAutoOn((on) => !on)}
            title="Плавно прокручивать текст автоматически"
          >
            {autoOn ? <Pause size={16} /> : <Play size={16} />} Автопрокрутка
          </button>
          <label className="reader-auto-speed">
            <span>Скорость</span>
            <select value={autoSpeed} onChange={(e) => changeAutoSpeed(Number(e.target.value))} aria-label="Скорость автопрокрутки">
              {AUTO_SPEEDS.map(([label, px]) => <option key={px} value={px}>{label}</option>)}
            </select>
          </label>
          <span className="reader-toolbar-sep" />
          <span className="reader-plain-pageno">прочитано {percentAt(visible.first)}%</span>
        </div>
      </div>

      <aside className="reader-plain-aside" aria-label="Закладки и заметки">
        <div className="reader-plain-aside-head">
          <Bookmark size={15} /> {showAllMarks ? 'Все отметки в книге' : 'В этом месте текста'}
          {shownItems.length > 0 && <span className="reader-plain-aside-count">{shownItems.length}</span>}
        </div>
        <div className="reader-plain-list">
          {shownItems.length === 0 && (
            <div className="reader-shelf-panel-sub">
              {listItems.length === 0 || showAllMarks
                ? 'Пока пусто. Выделите текст, чтобы отметить его цветом, оставить заметку или поставить закладку.'
                : 'Здесь отметок нет. Выделите текст, чтобы отметить его цветом, оставить заметку или поставить закладку.'}
            </div>
          )}
          {shownItems.map(({ kind, item, pos }) => (
            <button key={`${kind}-${item.id}`} type="button" className="reader-plain-list-item" onClick={() => openItem(kind, item)}>
              {kind === 'bookmark'
                ? <Bookmark size={15} className="reader-plain-list-icon" />
                : <span className="reader-plain-list-dot" style={{ background: item.color || COLORS[0] }} />}
              <span className="reader-plain-list-main">
                <span className="reader-plain-list-text">{kind === 'bookmark' ? item.snippet : item.text}</span>
                {kind === 'highlight' && item.note && <span className="reader-plain-list-note">{item.note}</span>}
              </span>
              {showAllMarks && <span className="reader-plain-list-pos">{percentAt(pos)}%</span>}
            </button>
          ))}
        </div>
        {listItems.length > 0 && (
          <button type="button" className="reader-plain-aside-toggle" onClick={() => setShowAllMarks((v) => !v)}>
            {showAllMarks ? 'Только то, что на экране' : `Все отметки в книге (${listItems.length})`}
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
