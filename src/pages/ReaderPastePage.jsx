import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as api from '../lib/api';
import { useReaderSettings } from '../lib/readerSettings';
import ReaderSettingsPanel from '../components/ReaderSettingsPanel';

const LANG_LABEL = { ru: 'RU', en: 'EN' };
// When reopening an existing book to add more text, show its tail for context.
const CONTEXT_TAIL = 6;

// "Empty book": the user pastes text into the left page, it's translated into
// the right page, and the result is saved as a regular book in the library
// (more text can be appended to it later).
export default function ReaderPastePage({ books, onCreate, onAppend, onRename, onPlace }) {
  const { bookId } = useParams();
  // Set when the new book was started from an empty place on the shelf.
  const [searchParams] = useSearchParams();
  const slotParam = searchParams.get('slot');
  const shelfSlot = slotParam != null && /^d+$/.test(slotParam) ? Number(slotParam) : null;
  const navigate = useNavigate();
  const { settings, update, reset, origStyle, trStyle } = useReaderSettings();

  const [book, setBook] = useState(null);
  const [title, setTitle] = useState('');
  const [pairs, setPairs] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Opening /reader/paste/:id (e.g. "Дописать текст" from the library, or a
  // reload right after creating): load the book and the tail of its text.
  useEffect(() => {
    if (!bookId || book?.id === bookId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const b = await api.getBook(bookId);
        const from = Math.max(0, b.paragraph_count - CONTEXT_TAIL);
        const data = await api.getBookParagraphs(bookId, from, CONTEXT_TAIL);
        if (cancelled) return;
        setBook(data.book);
        setTitle(data.book.title);
        setPairs(data.paragraphs);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const translate = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (book) {
        const data = await onAppend(book.id, text);
        setBook(data.book);
        setPairs((prev) => [...prev, ...data.paragraphs]);
      } else {
        const data = await onCreate({ title: title.trim(), text });
        if (shelfSlot != null) onPlace(data.book.id, shelfSlot);
        setBook(data.book);
        setTitle(data.book.title);
        setPairs(data.paragraphs);
        navigate(`/reader/paste/${data.book.id}`, { replace: true });
      }
      setDraft('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const saveTitle = async () => {
    const next = title.trim();
    if (!book || !next || next === book.title) return;
    try {
      setBook(await onRename(book.id, next));
    } catch (err) {
      setError(err.message);
    }
  };

  // The library's copy carries the up-to-date paragraph count.
  const libraryBook = book && books.find((b) => b.id === book.id);
  const pairLabel = book ? `${LANG_LABEL[book.source_lang]} → ${LANG_LABEL[book.target_lang]}` : 'Язык определится сам';

  return (
    <div className="reader-page reader-reading">
      <nav className="reader-subnav" aria-label="Читалка">
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader')}>Библиотека</button>
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader/cards')}>Карточки</button>
      </nav>

      <main className="reader-main reader-paste">
        <header className="reader-book-header">
          <div className="reader-book-header-meta">{book ? 'Своя книга' : 'Новая книга'} · {pairLabel}</div>
          <input
            className="reader-h1 reader-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="Название книги"
            aria-label="Название книги"
            maxLength={200}
          />
          {libraryBook && <div className="reader-paste-saved">Сохранено в библиотеке · {libraryBook.paragraph_count} абз.</div>}
        </header>

        {error && <div className="reader-error">{error}</div>}

        <div className="reader-spread">
          <div className="reader-spread-sheet left" aria-hidden="true" />
          <div className="reader-spread-sheet right" aria-hidden="true" />
          <div className="reader-side-head">
            <span style={{ color: 'var(--accent-teal-dark)' }}>Оригинал</span>
            <span />
            <span style={{ color: 'var(--accent-amber)' }}>Перевод</span>
          </div>

          {pairs.map((p) => (
            <div key={p.id} className="reader-para-row reader-para-row-static">
              <span className="reader-para-text" style={origStyle}>{p.text}</span>
              <span className="reader-para-num">
                <span className="reader-para-dot">{String(p.position + 1).padStart(2, '0')}</span>
              </span>
              <span className="reader-para-text reader-para-text-tr" style={trStyle}>{p.translation ?? '…'}</span>
            </div>
          ))}

          <div className="reader-para-row reader-para-row-static">
            <div className="reader-paste-cell">
              <textarea
                className="reader-paste-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) translate(); }}
                placeholder={pairs.length ? 'Вставьте ещё текст, чтобы дописать книгу…' : 'Вставьте сюда текст на русском или английском…'}
                style={origStyle}
                rows={8}
                disabled={busy}
              />
            </div>
            <span />
            <div className="reader-paste-cell reader-paste-hint">
              {busy ? 'Переводим…' : 'Здесь появится перевод. Каждая строка или абзац переводится отдельно.'}
            </div>
          </div>
        </div>

        <div className="reader-toolbar">
          <button type="button" className="reader-btn-solid reader-btn-coral" onClick={translate} disabled={busy || !draft.trim()}>
            {busy ? 'Переводим…' : 'Перевести'}
          </button>
          <span className="reader-toolbar-sep" />
          <ReaderSettingsPanel settings={settings} update={update} reset={reset} />
          {book && (
            <>
              <span className="reader-toolbar-sep" />
              <button type="button" className="reader-mode-btn" onClick={() => navigate(`/reader/book/${book.id}`)}>
                Открыть в читалке
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
