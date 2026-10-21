import { useLayoutEffect, useRef } from 'react';
import { stripOuterQuotes } from '../lib/quotes';

const DEFAULT_QUOTE = { text: 'There is no friend as loyal as a book.', author: 'Ernest Hemingway' };

// Typesets a quote like the print in the frame — centred serif lines in
// curly quotes with a smaller "— Author" line under it — at the largest font
// size that still fits its box. Re-fits when the box resizes (the shelf photo
// scales with the page) and once the webfont has loaded.
export default function FittedQuote({ quote }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const { author } = quote || DEFAULT_QUOTE;
  const text = stripOuterQuotes((quote || DEFAULT_QUOTE).text);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return undefined;
    const fit = () => {
      let lo = 3, hi = 64;
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        inner.style.fontSize = `${mid}px`;
        const fits = inner.scrollHeight <= box.clientHeight && inner.scrollWidth <= box.clientWidth;
        if (fits) lo = mid; else hi = mid;
      }
      inner.style.fontSize = `${lo}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) fit(); });
    return () => { cancelled = true; ro.disconnect(); };
  }, [text, author]);

  return (
    <span ref={boxRef} className="reader-quote-box">
      <span ref={innerRef} className="reader-quote-inner">
        <span className="reader-quote-text">“{text}”</span>
        {author && <span className="reader-quote-author">— {author}</span>}
      </span>
    </span>
  );
}
