import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as api from '../lib/api';
import { useReaderSettings } from '../lib/readerSettings';
import ReaderSettingsPanel from '../components/ReaderSettingsPanel';

const LANG_LABEL = { ru: 'RU', en: 'EN' };
// When reopening an existing book to add more text, show its tail for context.
const CONTEXT_TAIL = 6;
// After saving pasted text it is translated in small batches, several at
// once, so the right-hand page fills in quickly even for long text.
const TRANSLATE_BATCH = 6;
const TRANSLATE_PARALLEL = 3;

// "Empty book": the user pastes text into the left page, it's translated into
// the right page, and the result is saved as a regular book in the library
// (more text can be appended to it later).
export default function ReaderPastePage({ books, onCreate, onAppend, onRename, onPlace, onUpdate }) {
  const { bookId } = useParams();
  // Set when the new book was started from an empty place on the shelf.
  const [searchParams] = useSearchParams();
  const slotParam = searchParams.get('slot');
  const shelfSlot = slotParam != null && /^\d+$/.test(slotParam) ? Number(slotParam) : null;
  const navigate = useNavigate();
  const { settings, update, reset, origStyle, trStyle } = useReaderSettings();

  const [book, setBook] = useState(null);
  const [title, setTitle] = useState('');
  const [pairs, setPairs] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } while translating
  const [error, setError] = useState(null);
  // "Без перевода": text is only saved (for reading in Читалка), never sent
  // for translation. For an existing book this is its plain_only flag.
  const [plainNew, setPlainNew] = useState(false);

  // Opening /reader/paste/:id (e.g. "Дописать текст" from the library, or a
  // reload right after creating): load the book and the tail of its text.
  useEffect(() => {
    if (!bookId || book?.id === bookId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const b = await api.getBook(bookId);
        const from = Math.max(0, b.paragraph_count - CONTEXT_TAIL);
        // A no-translation book's tail is fetched without translating it.
        const data = await api.getBookParagraphs(bookId, from, CONTEXT_TAIL, { translate: !b.plain_only });
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

  // Saving returns the new paragraphs untranslated; translate them a page at
  // a time (the same cached endpoint the reader uses), filling the right-hand
  // page in as each batch arrives, so any amount of text can be pasted.
  const translateNew = async (bookId, rows) => {
    const starts = [];
    for (let i = 0; i < rows.length; i += TRANSLATE_BATCH) starts.push(i);
    let done = 0;
    setProgress({ done, total: rows.length });
    // A few batches in flight at once; each fills in as soon as it lands.
    const worker = async () => {
      while (starts.length) {
        const i = starts.shift();
        const data = await api.getBookParagraphs(bookId, rows[i].position, TRANSLATE_BATCH);
        const byId = new Map(data.paragraphs.map((p) => [p.id, p]));
        setPairs((prev) => prev.map((p) => byId.get(p.id) || p));
        done += Math.min(TRANSLATE_BATCH, rows.length - i);
        setProgress({ done, total: rows.length });
      }
    };
    await Promise.all(Array.from({ length: TRANSLATE_PARALLEL }, worker));
    setProgress(null);
  };

  const translate = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      let data;
      if (book) {
        data = await onAppend(book.id, text);
        setBook(data.book);
        setPairs((prev) => [...prev, ...data.paragraphs]);
      } else {
        data = await onCreate({ title: title.trim(), text, plainOnly: plainNew });
        if (shelfSlot != null) onPlace(data.book.id, shelfSlot);
        setBook(data.book);
        setTitle(data.book.title);
        setPairs(data.paragraphs);
        navigate(`/reader/paste/${data.book.id}`, { replace: true });
      }
      setDraft('');
      if (!data.book.plain_only) await translateNew(data.book.id, data.paragraphs);
    } catch (err) {
      setError(err.message);
      setProgress(null);
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

  const plainOnly = book ? !!book.plain_only : plainNew;
  const togglePlain = async (value) => {
    if (!book) { setPlainNew(value); return; }
    try { setBook(await onUpdate(book.id, { plain_only: value })); } catch (err) { setError(err.message); }
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
            <span style={{ color: 'var(--accent-amber)' }}>{plainOnly ? 'Без перевода' : 'Перевод'}</span>
          </div>

          {pairs.map((p) => (
            <div key={p.id} className="reader-para-row reader-para-row-static">
              <span className="reader-para-text" style={origStyle}>{p.text}</span>
              <span className="reader-para-num">
                <span className="reader-para-dot">{String(p.position + 1).padStart(2, '0')}</span>
              </span>
              <span className="reader-para-text reader-para-text-tr" style={trStyle}>{p.translation ?? (plainOnly ? '' : '…')}</span>
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
              {progress ? `Переводим… ${progress.done} из ${progress.total} абзацев` : busy ? 'Сохраняем…' : plainOnly ? 'Текст сохраняется как есть, без перевода — книга для чтения в Читалке.' : 'Здесь появится перевод. Каждая строка или абзац переводится отдельно.'}
            </div>
          </div>
        </div>

        <div className="reader-toolbar">
          <button type="button" className="reader-btn-solid reader-btn-coral" onClick={translate} disabled={busy || !draft.trim()}>
            {progress ? `Переводим… ${progress.done}/${progress.total}` : busy ? 'Сохраняем…' : plainOnly ? 'Сохранить' : 'Перевести'}
          </button>
          <label className="reader-check" title="Сохранять текст без перевода — книга для чтения в Читалке">
            <input type="checkbox" checked={plainOnly} onChange={(e) => togglePlain(e.target.checked)} disabled={busy} />
            Без перевода
          </label>
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
