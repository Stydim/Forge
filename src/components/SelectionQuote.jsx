import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Quote, X } from 'lucide-react';
import QuoteForm from './QuoteForm';

const POPOVER_W = 320;

// Watches text selections inside `containerRef` (the book's paragraphs) and,
// once a few words are selected, pops a "save as quote" menu next to them —
// the same popover as the shelf frame's. Selection settles via a debounced
// selectionchange, which also covers touch long-press + handle dragging.
export default function SelectionQuote({ containerRef, book, onSave }) {
  const [sel, setSel] = useState(null); // { text, top, left }
  const [saved, setSaved] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    let timer = null;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = window.getSelection();
        if (!s || s.isCollapsed || s.rangeCount === 0) return;
        const range = s.getRangeAt(0);
        const container = containerRef.current;
        if (!container || !container.contains(range.commonAncestorContainer)) return;
        const text = s.toString().replace(/\s+/g, ' ').trim();
        if (text.split(' ').length < 2) return; // a single word is a gloss lookup, not a quote
        const rect = range.getBoundingClientRect();
        const left = Math.min(
          Math.max(8, rect.left + rect.width / 2 - POPOVER_W / 2),
          document.documentElement.clientWidth - POPOVER_W - 8
        ) + window.scrollX;
        setSaved(false);
        setSel({ text, top: rect.bottom + window.scrollY + 10, left });
      }, 350);
    };
    document.addEventListener('selectionchange', onChange);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', onChange); };
  }, [containerRef]);

  useEffect(() => {
    if (!sel) return undefined;
    const onDown = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      // A new drag-selection replaces this one via selectionchange instead.
      if (containerRef.current?.contains(e.target)) return;
      setSel(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setSel(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sel, containerRef]);

  // Popover stays a moment after saving to confirm, then closes.
  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSel(null), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  if (!sel) return null;
  return createPortal(
    <div
      ref={popoverRef}
      className="reader-photo-popover reader-selection-popover"
      style={{ top: sel.top, left: sel.left, width: POPOVER_W }}
      role="dialog"
      aria-label="Сохранить цитату"
    >
      <div className="reader-shelf-panel-head">
        <span className="reader-selection-title"><Quote size={15} /> Сохранить цитату</span>
        <button type="button" className="reader-gloss-close" onClick={() => setSel(null)} aria-label="Закрыть"><X size={16} /></button>
      </div>
      {saved ? (
        <div className="reader-selection-saved">Сохранено — цитата висит в рамке на полке.</div>
      ) : (
        <QuoteForm
          key={sel.text}
          initialText={sel.text}
          initialAuthor={book.author || ''}
          bookId={book.id}
          onSave={async (q) => { await onSave(q); window.getSelection()?.removeAllRanges(); setSaved(true); }}
          onCancel={() => setSel(null)}
        />
      )}
    </div>,
    document.body
  );
}
