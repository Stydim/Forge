import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeftRight, X } from 'lucide-react';
import * as api from '../lib/api';
import { useReaderSettings } from '../lib/readerSettings';
import ReaderSettingsPanel from '../components/ReaderSettingsPanel';
import SpeakButton from '../components/SpeakButton';
import SelectionQuote from '../components/SelectionQuote';
import PlainReader from '../components/PlainReader';
import { flushOutbox, getCachedText, online } from '../lib/offline';

// The spread shows original and translation as two separate pages side by
// side, so it gets half as many paragraphs per page as the stacked modes.
const PAGE_SIZE_STACK = 15;
const PAGE_SIZE_SIDE = 8;
// 'plain' is the whole book as continuous original text, no translation.
const MODES = [['side', 'Разворот'], ['inter', 'Строка под строкой'], ['orig', 'Оригинал'], ['plain', 'Читалка']];
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

// Words are spans with a button role rather than <button>s: a drag that
// starts on a <button> never becomes a text selection, and selecting several
// words is how a quote gets saved. A click that ends a selection isn't a tap.
function TappableText({ text, onWordTap, activeWord }) {
  const parts = useMemo(() => splitWords(text), [text]);
  const tap = (e, word) => {
    e.stopPropagation();
    if (window.getSelection()?.toString().trim()) return;
    onWordTap(word);
  };
  return (
    <>
      {parts.map((p, i) => (p.word ? (
        <span
          key={i}
          role="button"
          tabIndex={0}
          className={`reader-word${activeWord && activeWord.toLowerCase() === p.text.toLowerCase() ? ' active' : ''}`}
          onClick={(e) => tap(e, p.text)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(e, p.text); } }}
        >
          {p.text}
        </span>
      ) : (
        <span key={i}>{p.text}</span>
      )))}
    </>
  );
}

export default function ReaderPage({ onProgress, savedWords, onSaveQuote }) {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [pageStart, setPageStart] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [mode, setMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'inter' : 'side'));
  const [swapped, setSwapped] = useState(false);
  const { settings, update: updateSettings, reset: resetSettings, origStyle, trStyle } = useReaderSettings();
  const pageSize = mode === 'side' ? PAGE_SIZE_SIDE : PAGE_SIZE_STACK;
  // Where the plain reader is scrolled to; leaving it reopens the paged
  // modes at that spot.
  const [plainPos, setPlainPos] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // side: which text the word was tapped in ('orig' | 'tr'); lang: its language.
  const [gloss, setGloss] = useState(null); // { word, context, side, lang, data, loading, error }
  const [speakError, setSpeakError] = useState(null);
  const textRef = useRef(null);

  const loadPage = useCallback(async (start, size) => {
    setPageLoading(true);
    setPageError(null);
    try {
      const data = await api.getBookParagraphs(bookId, start, size);
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
        // A position saved offline goes out first, so the book opens there.
        await flushOutbox();
        let b;
        let saved = false;
        try {
          b = await online(() => api.getBook(bookId));
        } catch (err) {
          // Offline: a book opened before has a saved copy, readable in Читалка.
          const cached = err.offline ? await getCachedText(bookId) : null;
          if (!cached?.book) throw err.offline ? new Error('нет сети, а эта книга ещё не сохранена на устройстве. Откройте её один раз с интернетом в режиме «Читалка».') : err;
          b = cached.book;
          saved = true;
        }
        if (cancelled) return;
        const start = Math.min(b.current_paragraph, Math.max(0, b.paragraph_count - 1));
        setPageStart(start);
        if (b.plain_only || saved) {
          // A no-translation book opens straight in Читалка; nothing gets
          // translated unless a translated mode is picked by hand.
          setBook(b);
          setPlainPos(start);
          setMode('plain');
          setPageLoading(false);
          return;
        }
        loadPage(start, pageSize);
      } catch (err) {
        if (!cancelled) setPageError(err.message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // Switching between spread and stacked modes changes the page size, so
  // re-fetch the current page at the new size (translations are cached).
  const loadedSizeRef = useRef(pageSize);
  useEffect(() => {
    if (loadedSizeRef.current === pageSize) return;
    loadedSizeRef.current = pageSize;
    // Not in Читалка: it has its own text, and loading a page would translate it.
    if (book && mode !== 'plain') loadPage(pageStart, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const isLastPage = book && pageStart + paragraphs.length >= book.paragraph_count;
  const isFirstPage = pageStart <= 0;

  const goNext = () => {
    if (!book) return;
    const next = Math.min(pageStart + pageSize, Math.max(0, book.paragraph_count - 1));
    setPageStart(next);
    onProgress(bookId, next);
    loadPage(next, pageSize);
  };
  const goPrev = () => {
    const prev = Math.max(0, pageStart - pageSize);
    setPageStart(prev);
    onProgress(bookId, prev);
    loadPage(prev, pageSize);
  };
  const changeMode = (next) => {
    if (mode === 'plain' && next !== 'plain' && plainPos != null) {
      const size = next === 'side' ? PAGE_SIZE_SIDE : PAGE_SIZE_STACK;
      loadedSizeRef.current = size;
      setPageStart(plainPos);
      loadPage(plainPos, size);
    }
    if (next === 'plain') setPlainPos(pageStart);
    setMode(next);
  };

  const finishBook = () => {
    if (!book) return;
    onProgress(bookId, book.paragraph_count);
    navigate('/reader');
  };

  // Words can be looked up in either text: in the translation the lookup just
  // runs the other way (target -> source language).
  const openWordGloss = useCallback(async (word, context, idx, side) => {
    setActiveIdx(idx);
    if (!book) return;
    const lang = side === 'orig' ? book.source_lang : book.target_lang;
    const other = side === 'orig' ? book.target_lang : book.source_lang;
    const base = { word, context, side, lang };
    setGloss({ ...base, data: null, loading: true, error: null });
    try {
      const data = await api.glossWord(word, context, lang, other);
      setGloss({ ...base, data, loading: false, error: null });
    } catch (err) {
      setGloss({ ...base, data: null, loading: false, error: err.message });
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
        source_lang: gloss.lang,
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

  // Paragraph text with every word tappable; the tapped word stays
  // highlighted only on the side it was tapped on.
  const renderText = (p, i, side) => {
    const text = side === 'orig' ? p.text : p.translation;
    if (!text) return '…';
    const active = i === activeIdx && gloss?.side === side ? gloss.word : null;
    return <TappableText text={text} activeWord={active} onWordTap={(w) => openWordGloss(w, text, i, side)} />;
  };

  const readPos = mode === 'plain' && plainPos != null ? plainPos : pageStart;
  const progress = book.paragraph_count ? Math.min(100, Math.round((readPos / book.paragraph_count) * 100)) : 0;
  const leftLang = swapped ? book.target_lang : book.source_lang;
  const rightLang = swapped ? book.source_lang : book.target_lang;
  const leftColor = leftLang === book.source_lang ? 'var(--accent-teal-dark)' : 'var(--accent-amber)';
  const rightColor = rightLang === book.source_lang ? 'var(--accent-teal-dark)' : 'var(--accent-amber)';

  return (
    <div className="reader-page reader-reading">
      <nav className="reader-subnav" aria-label="Библиотека">
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader')}>Библиотека</button>
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader/cards')}>Карточки</button>
      </nav>

      <div className={`reader-reading-layout${mode === 'plain' ? ' plain' : ''}`}>
        <main className="reader-main" ref={textRef}>
          {mode !== 'plain' && <SelectionQuote containerRef={textRef} book={book} onSave={onSaveQuote} />}
          <header className="reader-book-header">
            <div className="reader-book-header-meta">{book.author || ' '}</div>
            <h1 className="reader-h1">{book.title}</h1>
          </header>

          {mode !== 'plain' && pageLoading && <div className="reader-translating">Переводим абзацы…</div>}
          {mode !== 'plain' && pageError && <div className="reader-error">{pageError}</div>}

          {mode === 'plain' ? (
            <PlainReader
              book={{ ...book, current_paragraph: pageStart }}
              textStyle={origStyle}
              onProgress={onProgress}
              onPosition={setPlainPos}
              onSaveQuote={onSaveQuote}
            />
          ) : mode === 'side' ? (
            <div className="reader-spread">
              <div className="reader-spread-sheet left" aria-hidden="true" />
              <div className="reader-spread-sheet right" aria-hidden="true" />
              <div className="reader-side-head">
                <span style={{ color: leftColor }}>{LANG_LABEL[leftLang]}</span>
                <span />
                <span style={{ color: rightColor }}>{LANG_LABEL[rightLang]}</span>
              </div>
              {paragraphs.map((p, i) => {
                const on = i === activeIdx;
                const original = p.text;
                const origCell = (
                  <span className="reader-para-text" style={origStyle}>
                    {renderText(p, i, 'orig')}
                    <SpeakButton className="reader-para-speak" text={original} lang={book.source_lang} onError={setSpeakError} />
                  </span>
                );
                const trCell = (
                  <span className="reader-para-text reader-para-text-tr" style={trStyle}>
                    {renderText(p, i, 'tr')}
                    {p.translation && <SpeakButton className="reader-para-speak" text={p.translation} lang={book.target_lang} onError={setSpeakError} />}
                  </span>
                );
                return (
                  <div key={p.id} className={`reader-para-row${on ? ' active' : ''}`} onClick={() => setActiveIdx(i)}>
                    {swapped ? trCell : origCell}
                    <span className="reader-para-num">
                      <span className="reader-para-dot">{String(p.position + 1).padStart(2, '0')}</span>
                    </span>
                    {swapped ? origCell : trCell}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="reader-paragraphs stack">
              {paragraphs.map((p, i) => {
                const on = i === activeIdx;
                const showTranslation = mode === 'inter' || on;
                return (
                  <div key={p.id} className={`reader-para-stack-row${on ? ' active' : ''}`} onClick={() => setActiveIdx(i)}>
                    <span className="reader-para-num-inline">{String(p.position + 1).padStart(2, '0')}</span>
                    <div className="reader-para-stack-text">
                      <p className="reader-para-original" style={origStyle}>
                        {renderText(p, i, 'orig')}
                        <SpeakButton className="reader-para-speak" text={p.text} lang={book.source_lang} onError={setSpeakError} />
                      </p>
                      {showTranslation && (
                        <p className="reader-para-translation" style={trStyle}>
                          {renderText(p, i, 'tr')}
                          {p.translation && <SpeakButton className="reader-para-speak" text={p.translation} lang={book.target_lang} onError={setSpeakError} />}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="reader-toolbar">
            <div className="reader-mode-group" role="group" aria-label="Режим чтения">
              {MODES.map(([id, label]) => (
                <button key={id} type="button" className={`reader-mode-btn${mode === id ? ' active' : ''}`} onClick={() => changeMode(id)}>
                  {label}
                </button>
              ))}
            </div>
            {mode !== 'plain' && (
              <>
                <span className="reader-toolbar-sep" />
                <button type="button" className="reader-swap-btn" onClick={() => setSwapped((s) => !s)} aria-label="Поменять языки местами">
                  <span style={{ color: leftColor }}>{LANG_LABEL[leftLang]}</span>
                  <ArrowLeftRight size={14} />
                  <span style={{ color: rightColor }}>{LANG_LABEL[rightLang]}</span>
                </button>
              </>
            )}
            <span className="reader-toolbar-sep" />
            <ReaderSettingsPanel settings={settings} update={updateSettings} reset={resetSettings} />
            <span className="reader-toolbar-sep" />
            <div className="reader-progress-badge">{progress}%</div>
            {mode !== 'plain' && (
              <>
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
              </>
            )}
          </div>
        </main>

        {mode !== 'plain' && (
        <aside className="reader-aside">
          <section className="reader-gloss-panel" aria-label="Глосса">
            {!gloss && <div className="reader-gloss-empty">Нажмите на любое слово — в оригинале или в переводе, — чтобы увидеть перевод и добавить его в колоду. Выделите несколько слов, чтобы сохранить цитату.</div>}
            {gloss?.loading && <div className="reader-gloss-empty">Ищу перевод…</div>}
            {gloss?.error && <div className="reader-error">{gloss.error}</div>}
            {gloss?.data && (
              <>
                <div className="reader-gloss-head">
                  <span className="reader-gloss-word-row">
                    <span className="reader-gloss-word">{gloss.data.base_form}</span>
                    <SpeakButton text={gloss.data.base_form} lang={gloss.lang} size={18} onError={setSpeakError} />
                  </span>
                  <button type="button" className="reader-gloss-close" onClick={() => setGloss(null)} aria-label="Закрыть">
                    <X size={16} />
                  </button>
                </div>
                <div className="reader-gloss-pos">{gloss.data.part_of_speech}</div>
                <div className="reader-gloss-translation">{gloss.data.translation}</div>
                {gloss.data.example_source && (
                  <div className="reader-gloss-example">
                    <div className="reader-gloss-example-src">
                      <span>{gloss.data.example_source}</span>
                      <SpeakButton text={gloss.data.example_source} lang={gloss.lang} size={14} onError={setSpeakError} />
                    </div>
                    <div className="reader-gloss-example-tr">{gloss.data.example_translation}</div>
                  </div>
                )}
                <button type="button" className={`reader-save-btn${isWordSaved ? ' saved' : ''}`} onClick={toggleSaveWord}>
                  {isWordSaved ? 'В колоде ✓' : 'Добавить в колоду'}
                </button>
              </>
            )}
          </section>

          {speakError && (
            <div className="reader-error reader-speak-error">
              <span>{speakError}</span>
              <button type="button" className="reader-gloss-close" onClick={() => setSpeakError(null)} aria-label="Закрыть"><X size={14} /></button>
            </div>
          )}

          <Link to="/reader/cards" className="reader-deck-card">
            <div className="reader-deck-card-row">
              <span className="reader-eyebrow">Колода</span>
              <span className="reader-deck-count">{savedWords.words.length}</span>
            </div>
            <span className="reader-deck-cta">Повторить сейчас →</span>
          </Link>
        </aside>
        )}
      </div>
    </div>
  );
}
