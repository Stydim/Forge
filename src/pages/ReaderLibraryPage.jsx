import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

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

function spineHeight(book) {
  const h = 200 + Math.min(120, Math.round(book.paragraph_count / 8));
  return h;
}

function spineWidth(book) {
  return 38 + Math.min(40, Math.round(book.paragraph_count / 20));
}

export default function ReaderLibraryPage({ books, loading, error, onUpload, onDelete }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const sorted = useMemo(() => [...books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [books]);
  const reading = useMemo(() => sorted.find((b) => bookStatus(b) === 'reading') || sorted[0], [sorted]);
  const filtered = useMemo(
    () => sorted.filter((b) => filter === 'all' || bookStatus(b) === filter),
    [sorted, filter]
  );
  const selected = filtered.find((b) => b.id === selectedId) || filtered[0] || null;

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
      setPendingFile(null);
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
        <button type="button" className="reader-btn-outline" onClick={pickFile} disabled={uploading}>
          <Plus size={18} />
          Загрузить TXT, EPUB или FB2
        </button>
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
            <button type="button" className="reader-btn-ghost" disabled={uploading} onClick={() => setPendingFile(null)}>Отмена</button>
          </div>
          {uploading && <span className="reader-upload-status">Разбираю файл…</span>}
        </div>
      )}
      {uploadError && <div className="reader-error">Не удалось загрузить книгу: {uploadError}</div>}
      {error && <div className="reader-error">Не удалось связаться с базой: {error}</div>}

      {reading && (
        <section className="reader-hero" aria-label="Сейчас читаю">
          <div className="reader-hero-cell reader-hero-coral">
            <span className="reader-eyebrow">Оригинал · {LANG_LABEL[reading.source_lang]}</span>
            <h2 className="reader-hero-title">{reading.title}</h2>
            {reading.author && <span className="reader-hero-author">{reading.author}</span>}
            <button type="button" className="reader-hero-cta" onClick={() => navigate(`/reader/book/${reading.id}`)}>
              {STATUS_CTA[bookStatus(reading)]} →
            </button>
          </div>
          <div className="reader-hero-cell reader-hero-cyan">
            <span className="reader-eyebrow">Перевод · {LANG_LABEL[reading.target_lang]}</span>
            <div className="reader-hero-progress-row">
              <span>Прогресс</span>
              <span>{bookProgress(reading)}%</span>
            </div>
            <div className="reader-progress-track"><div className="reader-progress-fill" style={{ width: `${bookProgress(reading)}%` }} /></div>
          </div>
        </section>
      )}

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

        {!loading && filtered.length === 0 && (
          <div className="reader-empty">
            {books.length === 0 ? 'Пока нет ни одной книги — загрузите первую.' : 'В этом фильтре пока пусто.'}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="reader-shelf-row">
            <div className="reader-shelf">
              <div className="reader-shelf-books">
                {filtered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`reader-spine${selected?.id === b.id ? ' selected' : ''}`}
                    style={{
                      width: spineWidth(b),
                      height: spineHeight(b),
                      background: b.spine_color,
                      color: b.spine_color === '#2C3140' || b.spine_color === '#1F2228' ? '#ECEAE4' : '#111214',
                    }}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <span className="reader-spine-band" />
                    <span className="reader-spine-title">{b.title}</span>
                    <span className="reader-spine-pair">{LANG_LABEL[b.source_lang]} → {LANG_LABEL[b.target_lang]}</span>
                  </button>
                ))}
              </div>
              <div className="reader-shelf-ledge" />
            </div>

            {selected && (
              <article className="reader-book-card">
                <span className="reader-eyebrow" style={{ color: selected.source_lang === 'ru' ? '#FF6A3D' : '#5CC8E0' }}>
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
        )}
      </section>
    </div>
  );
}
