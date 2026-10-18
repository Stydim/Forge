import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeftRight, X } from 'lucide-react';
import * as api from '../lib/api';

const PAGE_SIZE = 15;
const MIN_SIZE = 15;
const MAX_SIZE = 26;
const MODES = [['side', 'Разворот'], ['inter', 'Строка под строкой'], ['orig', 'Оригинал']];
const LANG_LABEL = { ru: 'RU', en: 'EN' };

// Splits paragraph text into alternating plain-text and word tokens so each
// word in the source language can be an individual tap target, while
// punctuation/whitespace stays inert plain text in between.
const WORD_RE = /[A-Za-zА-Яа-яЁё]+(?:[-'][A-Za-zА-Яа-яЁё]+)*/g;
function splitWords(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    if (m.index > last) parts.push({ word: false, text: text.slice(last, m.index) });
    parts.push({ word: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ word: false, text: text.slice(last) });
  return parts;
}

function TappableText({ text, fontSize, onWordTap, activeWord }) {
  const parts = useMemo(() => splitWords(text), [text]);
  return (
    <>
      {parts.map((p, i) => (p.word ? (
        <button
          key={i}
          type="button"
          className={`reader-word${activeWord && activeWord.toLowerCase() === p.text.toLowerCase() ? ' active' : ''}`}
          style={{ fontSize }}
          onClick={(e) => { e.stopPropagation(); onWordTap(p.text); }}
        >
          {p.text}
        </button>
      ) : (
        <span key={i}>{p.text}</span>
      )))}
    </>
  );
}

export default function ReaderPage({ onProgress, savedWords }) {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [pageStart, setPageStart] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [mode, setMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'inter' : 'side'));
  const [swapped, setSwapped] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [activeIdx, setActiveIdx] = useState(0);

  const [gloss, setGloss] = useState(null); // { word, context, data, loading, error }

  const loadPage = useCallback(async (start) => {
    setPageLoading(true);
    setPageError(null);
    try {
      const data = await api.getBookParagraphs(bookId, start, PAGE_SIZE);
      setBook(data.book);
      setParagraphs(data.paragraphs);
      setActiveIdx(0);
      setGloss(null);
    } catch (err) {
      setPageError(err.message);
    }
    setPageLoading(false);
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await api.getBook(bookId);
        if (cancelled) return;
        const start = Math.min(b.current_paragraph, Math.max(0, b.paragraph_count - 1));
        setPageStart(start);
        loadPage(start);
      } catch (err) {
        if (!cancelled) setPageError(err.message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const isLastPage = book && pageStart + paragraphs.length >= book.paragraph_count;
  const isFirstPage = pageStart <= 0;

  const goNext = () => {
    if (!book) return;
    const next = Math.min(pageStart + PAGE_SIZE, Math.max(0, book.paragraph_count - 1));
    setPageStart(next);
    onProgress(bookId, next);
    loadPage(next);
  };
  const goPrev = () => {
    const prev = Math.max(0, pageStart - PAGE_SIZE);
    setPageStart(prev);
    onProgress(bookId, prev);
    loadPage(prev);
  };
  const finishBook = () => {
    if (!book) return;
    onProgress(bookId, book.paragraph_count);
    navigate('/reader');
  };

  const openWordGloss = useCallback(async (word, context, idx) => {
    setActiveIdx(idx);
    if (!book) return;
    setGloss({ word, context, data: null, loading: true, error: null });
    try {
      const data = await api.glossWord(word, context, book.source_lang, book.target_lang);
      setGloss({ word, context, data, loading: false, error: null });
    } catch (err) {
      setGloss({ word, context, data: null, loading: false, error: err.message });
    }
  }, [book]);

  const isWordSaved = gloss?.data && savedWords.isSaved(gloss.data.base_form);
  const toggleSaveWord = async () => {
    if (!gloss?.data) return;
    const existing = savedWords.words.find((w) => w.word.toLowerCase() === gloss.data.base_form.toLowerCase());
    if (existing) {
      await savedWords.remove(existing.id);
    } else {
      await savedWords.save({
        word: gloss.data.base_form,
        base_form: gloss.data.base_form,
        source_lang: book.source_lang,
        translation: gloss.data.translation,
        part_of_speech: gloss.data.part_of_speech,
        example_source: gloss.data.example_source,
        example_translation: gloss.data.example_translation,
        book_id: book.id,
      });
    }
  };

  if (pageError && !book) {
    return (
      <div className="reader-page">
        <div className="reader-error">Не удалось открыть книгу: {pageError}</div>
        <Link to="/reader" className="reader-btn-outline">← К библиотеке</Link>
      </div>
    );
  }
  if (!book) return <div className="reader-page reader-loading">Загрузка…</div>;

  const progress = book.paragraph_count ? Math.min(100, Math.round((pageStart / book.paragraph_count) * 100)) : 0;
  const leftLang = swapped ? book.target_lang : book.source_lang;
  const rightLang = swapped ? book.source_lang : book.target_lang;
  const leftColor = leftLang === book.source_lang ? 'var(--accent-teal-dark)' : 'var(--accent-amber)';
  const rightColor = rightLang === book.source_lang ? 'var(--accent-teal-dark)' : 'var(--accent-amber)';

  return (
    <div className="reader-page reader-reading">
      <nav className="reader-subnav" aria-label="Читалка">
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader')}>Библиотека</button>
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader/cards')}>Карточки</button>
      </nav>

      <div className="reader-reading-layout">
        <main className="reader-main">
          <header className="reader-book-header">
            <div className="reader-book-header-meta">{book.author || ' '}</div>
            <h1 className="reader-h1">{book.title}</h1>
          </header>

          {pageLoading && <div className="reader-translating">Переводим абзацы…</div>}
          {pageError && <div className="reader-error">{pageError}</div>}

          {mode === 'side' && (
            <div className="reader-side-head">
              <span style={{ color: leftColor }}>{LANG_LABEL[leftLang]}</span>
              <span />
              <span style={{ color: rightColor }}>{LANG_LABEL[rightLang]}</span>
            </div>
          )}

          <div className={`reader-paragraphs${mode === 'side' ? ' side' : ' stack'}`}>
            {paragraphs.map((p, i) => {
              const on = i === activeIdx;
              const original = p.text;
              const translation = p.translation ?? '…';
              const left = swapped ? translation : original;
              const right = swapped ? original : translation;
              const leftIsOriginal = !swapped;
              const showTranslation = mode === 'inter' || on;

              if (mode === 'side') {
                return (
                  <div key={p.id} className={`reader-para-row${on ? ' active' : ''}`} onClick={() => setActiveIdx(i)}>
                    <span className="reader-para-text" style={{ fontSize }}>
                      {leftIsOriginal
                        ? <TappableText text={left} fontSize={fontSize} activeWord={on ? gloss?.word : null} onWordTap={(w) => openWordGloss(w, original, i)} />
                        : left}
                    </span>
                    <span className="reader-para-num">
                      <span className="reader-para-dot">{String(p.position + 1).padStart(2, '0')}</span>
                    </span>
                    <span className="reader-para-text" style={{ fontSize }}>
                      {!leftIsOriginal
                        ? <TappableText text={right} fontSize={fontSize} activeWord={on ? gloss?.word : null} onWordTap={(w) => openWordGloss(w, original, i)} />
                        : right}
                    </span>
                  </div>
                );
              }

              return (
                <div key={p.id} className={`reader-para-stack-row${on ? ' active' : ''}`} onClick={() => setActiveIdx(i)}>
                  <span className="reader-para-num-inline">{String(p.position + 1).padStart(2, '0')}</span>
                  <div className="reader-para-stack-text">
                    <p className="reader-para-original" style={{ fontSize }}>
                      <TappableText text={original} fontSize={fontSize} activeWord={on ? gloss?.word : null} onWordTap={(w) => openWordGloss(w, original, i)} />
                    </p>
                    {showTranslation && <p className="reader-para-translation">{translation}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="reader-toolbar">
            <div className="reader-mode-group" role="group" aria-label="Режим чтения">
              {MODES.map(([id, label]) => (
                <button key={id} type="button" className={`reader-mode-btn${mode === id ? ' active' : ''}`} onClick={() => setMode(id)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="reader-toolbar-sep" />
            <button type="button" className="reader-swap-btn" onClick={() => setSwapped((s) => !s)} aria-label="Поменять языки местами">
              <span style={{ color: leftColor }}>{LANG_LABEL[leftLang]}</span>
              <ArrowLeftRight size={14} />
              <span style={{ color: rightColor }}>{LANG_LABEL[rightLang]}</span>
            </button>
            <span className="reader-toolbar-sep" />
            <button type="button" className="reader-size-btn" style={{ fontSize: 14 }} onClick={() => setFontSize((s) => Math.max(MIN_SIZE, s - 1))} aria-label="Уменьшить шрифт">A</button>
            <button type="button" className="reader-size-btn" style={{ fontSize: 20 }} onClick={() => setFontSize((s) => Math.min(MAX_SIZE, s + 1))} aria-label="Увеличить шрифт">A</button>
            <span className="reader-toolbar-sep" />
            <div className="reader-progress-badge">{progress}%</div>
            <span className="reader-toolbar-sep" />
            <button type="button" className="reader-nav-btn" onClick={goPrev} disabled={isFirstPage} aria-label="Назад">
              <ChevronLeft size={18} />
            </button>
            {isLastPage ? (
              <button type="button" className="reader-btn-solid reader-btn-coral" onClick={finishBook}>Завершить книгу</button>
            ) : (
              <button type="button" className="reader-nav-btn" onClick={goNext} aria-label="Далее">
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </main>

        <aside className="reader-aside">
          <section className="reader-gloss-panel" aria-label="Глосса">
            {!gloss && <div className="reader-gloss-empty">Нажмите на любое слово в тексте, чтобы увидеть перевод.</div>}
            {gloss?.loading && <div className="reader-gloss-empty">Ищу перевод…</div>}
            {gloss?.error && <div className="reader-error">{gloss.error}</div>}
            {gloss?.data && (
              <>
                <div className="reader-gloss-head">
                  <span className="reader-gloss-word">{gloss.data.base_form}</span>
                  <button type="button" className="reader-gloss-close" onClick={() => setGloss(null)} aria-label="Закрыть">
                    <X size={16} />
                  </button>
                </div>
                <div className="reader-gloss-pos">{gloss.data.part_of_speech}</div>
                <div className="reader-gloss-translation">{gloss.data.translation}</div>
                {gloss.data.example_source && (
                  <div className="reader-gloss-example">
                    <div>{gloss.data.example_source}</div>
                    <div className="reader-gloss-example-tr">{gloss.data.example_translation}</div>
                  </div>
                )}
                <button type="button" className={`reader-save-btn${isWordSaved ? ' saved' : ''}`} onClick={toggleSaveWord}>
                  {isWordSaved ? 'В колоде ✓' : 'Добавить в колоду'}
                </button>
              </>
            )}
          </section>

          <Link to="/reader/cards" className="reader-deck-card">
            <div className="reader-deck-card-row">
              <span className="reader-eyebrow">Колода</span>
              <span className="reader-deck-count">{savedWords.words.length}</span>
            </div>
            <span className="reader-deck-cta">Повторить сейчас →</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
