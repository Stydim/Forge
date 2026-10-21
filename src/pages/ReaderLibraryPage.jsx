import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, MoveRight, Plus, Quote as QuoteIcon, Trash2, Undo2, X } from 'lucide-react';
import PhotoBookshelf from '../components/PhotoBookshelf';
import QuoteForm from '../components/QuoteForm';
import { stripOuterQuotes } from '../lib/quotes';

const LANG_LABEL = { ru: 'RU', en: 'EN' };
const STATUS_LABEL = { reading: 'Читаю', new: 'Не начата', done: 'Прочитана' };
const STATUS_CTA = { reading: 'Продолжить', new: 'Начать читать', done: 'Перечитать' };
const READ_PROMPT = { reading: 'Продолжить чтение?', new: 'Начать читать?', done: 'Перечитать книгу?' };
const FILTERS = [['all', 'Все'], ['reading', 'Читаю'], ['new', 'Не начаты'], ['done', 'Прочитаны']];

function bookStatus(book) {
  if (book.current_paragraph <= 0) return 'new';
  if (book.current_paragraph >= book.paragraph_count) return 'done';
  return 'reading';
}

function bookProgress(book) {
  if (!book.paragraph_count) return 0;
  return Math.min(100, Math.round((book.current_paragraph / book.paragraph_count) * 100));
}

export default function ReaderLibraryPage({ books, loading, error, onUpload, onDelete, onPlace, onUpdate, quotes }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  // Upload as a book just for reading (Читалка), with no translation.
  const [uploadPlain, setUploadPlain] = useState(false);
  // Shelf interaction: placingId = book waiting for the user to pick its
  // place; slotMenu = empty place that was clicked (offers what to put there);
  // pendingSlot = place an upload started from, applied once it finishes.
  const [placingId, setPlacingId] = useState(null);
  const [slotMenu, setSlotMenu] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
  // Book card's "Цитаты" section: which book it's open for, and whether its
  // add-a-quote form is showing.
  const [quotesFor, setQuotesFor] = useState(null);
  const [addingQuote, setAddingQuote] = useState(false);

  const sorted = useMemo(() => [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [books]);
  const filtered = useMemo(
    () => sorted.filter((b) => filter === 'all' || bookStatus(b) === filter),
    [sorted, filter]
  );
  const selected = sorted.find((b) => b.id === selectedId) || filtered[0] || null;
  const bookQuotes = useMemo(
    () => (selected ? quotes.quotes.filter((q) => q.book_id === selected.id) : []),
    [quotes.quotes, selected]
  );
  const unplaced = useMemo(() => sorted.filter((b) => b.shelf_slot == null), [sorted]);
  const dimmedIds = useMemo(
    () => new Set(sorted.filter((b) => filter !== 'all' && bookStatus(b) !== filter).map((b) => b.id)),
    [sorted, filter]
  );
  const placingBook = placingId ? sorted.find((b) => b.id === placingId) : null;

  const onSlotClick = (slot, book) => {
    if (placingBook) {
      onPlace(placingBook.id, slot);
      setSelectedId(placingBook.id);
      setPlacingId(null);
      setSlotMenu(null);
    } else if (book) {
      // A book's spine offers to open it right away (and selects its card).
      setSelectedId(book.id);
      setSlotMenu(slot);
    } else {
      setSlotMenu(slot);
    }
  };

  // The book standing on the place whose popover is open, if any.
  const slotBook = typeof slotMenu === 'number' ? sorted.find((b) => b.shelf_slot === slotMenu) : null;

  const placeHere = (bookId) => {
    onPlace(bookId, slotMenu);
    setSelectedId(bookId);
    setSlotMenu(null);
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
  };

  const confirmUpload = async (sourceLang) => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const book = await onUpload({ file: pendingFile, sourceLang, plainOnly: uploadPlain });
      if (pendingSlot != null) onPlace(book.id, pendingSlot);
      setPendingFile(null);
      setPendingSlot(null);
      setSelectedId(book.id);
    } catch (err) {
      setUploadError(err.message);
    }
    setUploading(false);
  };

  return (
    <div className="reader-page reader-library">
      <nav className="reader-subnav" aria-label="Библиотека">
        <span className="reader-subnav-active">Библиотека</span>
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader/cards')}>Карточки</button>
      </nav>

      <div className="reader-library-head">
        <h1 className="reader-h1">Моя <span className="reader-accent-coral">библиотека</span></h1>
        <div className="reader-library-actions">
          <button type="button" className="reader-btn-outline" onClick={() => navigate('/reader/new')}>
            <FilePlus2 size={18} />
            Новая книга из текста
          </button>
          <button type="button" className="reader-btn-outline" onClick={pickFile} disabled={uploading}>
            <Plus size={18} />
            Загрузить TXT, EPUB или FB2
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.epub,.fb2,text/plain,application/epub+zip"
          style={{ display: 'none' }}
          onChange={onFileChosen}
        />
      </div>

      {pendingFile && (
        <div className="reader-upload-prompt">
          <span>«{pendingFile.name}» — на каком языке эта книга?</span>
          <label className="reader-check">
            <input type="checkbox" checked={uploadPlain} onChange={(e) => setUploadPlain(e.target.checked)} disabled={uploading} />
            Без перевода — просто читать в Читалке
          </label>
          <div className="reader-upload-prompt-actions">
            <button type="button" className="reader-btn-solid reader-btn-coral" disabled={uploading} onClick={() => confirmUpload('ru')}>Русский</button>
            <button type="button" className="reader-btn-solid reader-btn-cyan" disabled={uploading} onClick={() => confirmUpload('en')}>English</button>
            <button type="button" className="reader-btn-ghost" disabled={uploading} onClick={() => { setPendingFile(null); setPendingSlot(null); }}>Отмена</button>
          </div>
          {uploading && <span className="reader-upload-status">Разбираю файл…</span>}
        </div>
      )}
      {uploadError && <div className="reader-error">Не удалось загрузить книгу: {uploadError}</div>}
      {error && <div className="reader-error">Не удалось связаться с базой: {error}</div>}

      <section className="reader-shelf-section" aria-label="Полка">
        <div className="reader-shelf-head">
          <h2 className="reader-section-label">Полка</h2>
          <div className="reader-filters" role="group" aria-label="Фильтр">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`reader-filter-chip${filter === id ? ' active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="reader-shelf-row">
          <div className="reader-shelf">
            <PhotoBookshelf
              books={sorted}
              selectedId={selected?.id}
              placing={!!placingBook}
              dimmedIds={dimmedIds}
              onSlotClick={onSlotClick}
              quote={quotes.quotes[0] || null}
              onFrameClick={() => { if (!placingBook) setSlotMenu('frame'); }}
              menuSlot={placingBook ? null : slotMenu}
              onMenuClose={() => setSlotMenu(null)}
              menu={slotMenu === 'frame' ? (
                <>
                  <div className="reader-shelf-panel-head">
                    <span>Цитата в рамке</span>
                    <button type="button" className="reader-gloss-close" onClick={() => setSlotMenu(null)} aria-label="Закрыть"><X size={16} /></button>
                  </div>
                  <QuoteForm books={sorted} onSave={async (q) => { await quotes.add(q); setSlotMenu(null); }} autoFocus />
                  {quotes.quotes.length > 0 && (
                    <>
                      <span className="reader-shelf-panel-sub">Сохранённые — нажмите, чтобы повесить в рамку:</span>
                      <div className="reader-quote-list">
                        {quotes.quotes.map((q, i) => (
                          <div key={q.id} className={`reader-quote-item${i === 0 ? ' current' : ''}`}>
                            <button type="button" className="reader-quote-item-main" onClick={() => quotes.pin(q.id)}>
                              <span className="reader-quote-item-text">“{stripOuterQuotes(q.text)}”</span>
                              {(q.author || q.book_title) && (
                                <span className="reader-quote-item-meta">— {[q.author, q.book_title && `«${q.book_title}»`].filter(Boolean).join(', ')}</span>
                              )}
                            </button>
                            <button type="button" className="reader-deck-row-delete" onClick={() => quotes.remove(q.id)} aria-label="Удалить цитату">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : slotBook ? (
                <>
                  <div className="reader-shelf-panel-head">
                    <span>{READ_PROMPT[bookStatus(slotBook)]}</span>
                    <button type="button" className="reader-gloss-close" onClick={() => setSlotMenu(null)} aria-label="Закрыть"><X size={16} /></button>
                  </div>
                  <div className="reader-read-prompt-title">{slotBook.title}</div>
                  {slotBook.author && <div className="reader-shelf-panel-sub">{slotBook.author}</div>}
                  {bookStatus(slotBook) === 'reading' && (
                    <div className="reader-read-prompt-progress">
                      <div className="reader-progress-track"><div className="reader-progress-fill" style={{ width: `${bookProgress(slotBook)}%` }} /></div>
                      <span>{bookProgress(slotBook)}%</span>
                    </div>
                  )}
                  <div className="reader-quote-actions">
                    <button type="button" className="reader-btn-solid reader-btn-coral" onClick={() => navigate(`/reader/book/${slotBook.id}`)} autoFocus>
                      {STATUS_CTA[bookStatus(slotBook)]}
                    </button>
                    <button type="button" className="reader-btn-ghost" onClick={() => setSlotMenu(null)}>Не сейчас</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="reader-shelf-panel-head">
                    <span>Свободное место — что поставить сюда?</span>
                    <button type="button" className="reader-gloss-close" onClick={() => setSlotMenu(null)} aria-label="Закрыть"><X size={16} /></button>
                  </div>
                  <button type="button" className="reader-popover-item" onClick={() => navigate(`/reader/new?slot=${slotMenu}`)}>
                    <FilePlus2 size={16} /> Новая книга из текста
                  </button>
                  <button type="button" className="reader-popover-item" onClick={() => { setPendingSlot(slotMenu); setSlotMenu(null); pickFile(); }} disabled={uploading}>
                    <Plus size={16} /> Загрузить файл
                  </button>
                  {unplaced.length > 0 && (
                    <>
                      <span className="reader-shelf-panel-sub">Или книгу, которой ещё нет на полке:</span>
                      {unplaced.map((b) => (
                        <button key={b.id} type="button" className="reader-popover-item reader-popover-book" onClick={() => placeHere(b.id)}>{b.title}</button>
                      ))}
                    </>
                  )}
                </>
              )}
            />

            {placingBook && (
              <div className="reader-shelf-panel">
                <span>Нажмите на корешок, куда поставить «{placingBook.title}»</span>
                <button type="button" className="reader-btn-ghost" onClick={() => setPlacingId(null)}>Отмена</button>
              </div>
            )}

            {!placingBook && unplaced.length > 0 && (
              <div className="reader-shelf-panel">
                <span className="reader-shelf-panel-sub">Ещё не на полке — выберите книгу, затем место для неё:</span>
                <div className="reader-filters">
                  {unplaced.map((b) => (
                    <button key={b.id} type="button" className="reader-filter-chip" onClick={() => { setPlacingId(b.id); setSelectedId(b.id); }}>{b.title}</button>
                  ))}
                </div>
              </div>
            )}

            {!loading && books.length === 0 && (
              <div className="reader-empty">Пока нет ни одной книги — нажмите на любой корешок, чтобы поставить на это место первую.</div>
            )}
          </div>

            {selected && (
              <article className="reader-book-card">
                <span className="reader-eyebrow" style={{ color: selected.source_lang === 'ru' ? 'var(--accent-teal-dark)' : 'var(--accent-amber)' }}>
                  {LANG_LABEL[selected.source_lang]} → {LANG_LABEL[selected.target_lang]}
                </span>
                <h3 className="reader-book-card-title">{selected.title}</h3>
                {selected.author && <div className="reader-book-card-author">{selected.author}</div>}
                <label className="reader-check reader-check-small" title="Книга открывается сразу в Читалке и не переводится автоматически">
                  <input type="checkbox" checked={!!selected.plain_only} onChange={(e) => onUpdate(selected.id, { plain_only: e.target.checked })} />
                  Без перевода
                </label>
                <div className="reader-book-card-foot">
                  <div className="reader-progress-row-small">
                    <span>{STATUS_LABEL[bookStatus(selected)]}</span>
                    <span>{bookProgress(selected)}%</span>
                  </div>
                  <div className="reader-progress-track"><div className="reader-progress-fill" style={{ width: `${bookProgress(selected)}%` }} /></div>
                  <button type="button" className="reader-btn-solid reader-btn-cream" onClick={() => navigate(`/reader/book/${selected.id}`)}>
                    {STATUS_CTA[bookStatus(selected)]}
                  </button>
                  <button type="button" className="reader-btn-ghost reader-book-add" onClick={() => { setSlotMenu(null); setPlacingId(selected.id); }}>
                    <MoveRight size={15} /> {selected.shelf_slot == null ? 'Поставить на полку' : 'Переставить'}
                  </button>
                  {selected.shelf_slot != null && (
                    <button type="button" className="reader-btn-ghost reader-book-add" onClick={() => onPlace(selected.id, null)}>
                      <Undo2 size={15} /> Убрать с полки
                    </button>
                  )}
                  <button type="button" className="reader-btn-ghost reader-book-add" onClick={() => navigate(`/reader/paste/${selected.id}`)}>
                    <FilePlus2 size={15} /> Дописать текст
                  </button>
                  <button
                    type="button"
                    className={`reader-btn-ghost reader-book-add${quotesFor === selected.id ? ' active' : ''}`}
                    onClick={() => { setQuotesFor((id) => (id === selected.id ? null : selected.id)); setAddingQuote(false); }}
                    aria-expanded={quotesFor === selected.id}
                  >
                    <QuoteIcon size={15} /> Цитаты{bookQuotes.length > 0 && ` (${bookQuotes.length})`}
                  </button>
                  {quotesFor === selected.id && (
                    <div className="reader-book-quotes">
                      {bookQuotes.length === 0 && !addingQuote && (
                        <div className="reader-shelf-panel-sub">Из этой книги цитат пока нет. Выделите несколько слов при чтении или добавьте вручную.</div>
                      )}
                      {bookQuotes.length > 0 && (
                        <div className="reader-quote-list">
                          {bookQuotes.map((q) => {
                            const inFrame = quotes.quotes[0]?.id === q.id;
                            return (
                              <div key={q.id} className={`reader-quote-item${inFrame ? ' current' : ''}`}>
                                <button
                                  type="button"
                                  className="reader-quote-item-main"
                                  onClick={() => quotes.pin(q.id)}
                                  title={inFrame ? 'Висит в рамке' : 'Повесить в рамку на полке'}
                                >
                                  <span className="reader-quote-item-text">“{stripOuterQuotes(q.text)}”</span>
                                  <span className="reader-quote-item-meta">{inFrame ? 'В рамке на полке' : 'Нажмите, чтобы повесить в рамку'}</span>
                                </button>
                                <button type="button" className="reader-deck-row-delete" onClick={() => quotes.remove(q.id)} aria-label="Удалить цитату">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {addingQuote ? (
                        <QuoteForm
                          key={selected.id}
                          initialAuthor={selected.author || ''}
                          bookId={selected.id}
                          onSave={async (q) => { await quotes.add(q); setAddingQuote(false); }}
                          onCancel={() => setAddingQuote(false)}
                          autoFocus
                        />
                      ) : (
                        <button type="button" className="reader-popover-item" onClick={() => setAddingQuote(true)}>
                          <Plus size={16} /> Добавить цитату
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="reader-btn-ghost reader-book-delete"
                    onClick={() => { if (window.confirm(`Удалить «${selected.title}» насовсем?`)) onDelete(selected.id); }}
                  >
                    <Trash2 size={15} /> Удалить книгу
                  </button>
                </div>
              </article>
            )}
        </div>
      </section>
    </div>
  );
}
