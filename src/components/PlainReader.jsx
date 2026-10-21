import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkMinus, Check, Copy, NotebookPen, Quote, Share2, Trash2 } from 'lucide-react';
import * as api from '../lib/api';

// Highlight palette, as in the selection menu: soft tints that keep text
// readable on the page.
const COLORS = ['#D3D3DB', '#D9B8F5', '#BDBDEB', '#F5D9A8', '#BEEBF5', '#F2B49E', '#BDBDBD', '#A6D9AE'];
const MENU_W = 360;

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

// "Читалка" mode: the whole original book as continuous text — no
// translation — with highlights in colours, notes, bookmarks, and a
// selection menu (colours / note / bookmark / copy / share / quote / delete).
// Reading position follows the scroll.
export default function PlainReader({ book, textStyle, onProgress, onPosition, onSaveQuote }) {
  const [paragraphs, setParagraphs] = useState(null);
  const [error, setError] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [menu, setMenu] = useState(null); // { range | highlight, top, left }
  const [noteDraft, setNoteDraft] = useState(null); // string while editing a note
  const [toast, setToast] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const articleRef = useRef(null);
  const menuRef = useRef(null);

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

  const scrollToPara = useCallback((pos, smooth) => {
    const el = articleRef.current?.querySelector(`[data-pos="${pos}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Open where the reader left off.
  const openedRef = useRef(false);
  useEffect(() => {
    if (!paragraphs || openedRef.current) return;
    openedRef.current = true;
    const pos = Math.min(book.current_paragraph, paragraphs.length - 1);
    if (pos > 0) requestAnimationFrame(() => scrollToPara(pos, false));
  }, [paragraphs, book.current_paragraph, scrollToPara]);

  // Reading position = first paragraph still visible at the top; saved a
  // moment after scrolling stops.
  useEffect(() => {
    if (!paragraphs) return undefined;
    let raf = 0;
    let saveTimer = null;
    let pending = null; // position scrolled to but not saved yet
    let last = null;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const els = articleRef.current?.querySelectorAll('[data-pos]') || [];
        let pos = 0;
        for (const el of els) {
          if (el.getBoundingClientRect().bottom > 80) { pos = Number(el.dataset.pos); break; }
        }
        if (pos === last) return;
        last = pos;
        onPosition(pos);
        pending = pos;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { onProgress(book.id, pos); pending = null; }, 1200);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(saveTimer);
      // Leaving the mode/page right after scrolling: save where we got to.
      if (pending != null) onProgress(book.id, pending);
    };
  }, [paragraphs, book.id, onProgress, onPosition]);

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
      if (menuRef.current?.contains(e.target) || articleRef.current?.contains(e.target)) return;
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

  return (
    <div className="reader-plain-wrap">
      <div className="reader-plain-bar">
        <button type="button" className={`reader-filter-chip${listOpen ? ' active' : ''}`} onClick={() => setListOpen((o) => !o)}>
          <Bookmark size={14} /> Закладки и заметки{listItems.length ? ` (${listItems.length})` : ''}
        </button>
      </div>

      {listOpen && (
        <div className="reader-plain-list">
          {listItems.length === 0 && <div className="reader-shelf-panel-sub">Пока пусто. Выделите текст, чтобы отметить его цветом, оставить заметку или поставить закладку.</div>}
          {listItems.map(({ kind, pos, item }) => (
            <button key={`${kind}-${item.id}`} type="button" className="reader-plain-list-item" onClick={() => scrollToPara(pos, true)}>
              {kind === 'bookmark'
                ? <Bookmark size={15} className="reader-plain-list-icon" />
                : <span className="reader-plain-list-dot" style={{ background: item.color || COLORS[0] }} />}
              <span className="reader-plain-list-main">
                <span className="reader-plain-list-text">{kind === 'bookmark' ? item.snippet : item.text}</span>
                {kind === 'highlight' && item.note && <span className="reader-plain-list-note">{item.note}</span>}
              </span>
              <span className="reader-plain-list-pos">§{pos + 1}</span>
            </button>
          ))}
        </div>
      )}

      <article ref={articleRef} className="reader-plain" style={textStyle} lang={book.source_lang} onClick={onArticleClick}>
        {body}
      </article>

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
