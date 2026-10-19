import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, MoveRight, Plus, Trash2, Undo2, X } from 'lucide-react';
import PhotoBookshelf from '../components/PhotoBookshelf';

const LANG_LABEL = { ru: 'RU', en: 'EN' };
const STATUS_LABEL = { reading: 'Читаю', new: 'Не начата', done: 'Прочитана' };
const STATUS_CTA = { reading: 'Продолжить', new: 'Начать читать', done: 'Перечитать' };
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

export default function ReaderLibraryPage({ books, loading, error, onUpload, onDelete, onPlace }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  // Shelf interaction: placingId = book waiting for the user to pick its
  // place; slotMenu = empty place that was clicked (offers what to put there);
  // pendingSlot = place an upload started from, applied once it finishes.
  const [placingId, setPlacingId] = useState(null);
  const [slotMenu, setSlotMenu] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);

  const sorted = useMemo(() => [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [books]);
  const filtered = useMemo(
    () => sorted.filter((b) => filter === 'all' || bookStatus(b) === filter),
    [sorted, filter]
  );
  const selected = sorted.find((b) => b.id === selectedId) || filtered[0] || null;
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
      setSelectedId(book.id);
      setSlotMenu(null);
    } else {
      setSlotMenu(slot);
    }
  };

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
      const book = await onUpload({ file: pendingFile, sourceLang });
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
      <nav className="reader-subnav" aria-label="Читалка">
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
              menuSlot={placingBook ? null : slotMenu}
              onMenuClose={() => setSlotMenu(null)}
              menu={(
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
