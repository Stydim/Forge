import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import * as api from '../lib/api';
import SpeakButton from '../components/SpeakButton';

const otherLang = (lang) => (lang === 'ru' ? 'en' : 'ru');
const detectLang = (text) => ((text.match(/[А-Яа-яЁё]/g) || []).length >= (text.match(/[A-Za-z]/g) || []).length ? 'ru' : 'en');

// Look up any word or short phrase typed by hand (Russian or English, the
// language is detected) and add it to the deck without needing a book.
function AddWord({ savedWords, onAdded, onSpeakError }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null); // { lang, data }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const lookup = async (e) => {
    e.preventDefault();
    const word = text.trim();
    if (!word || busy) return;
    const lang = detectLang(word);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.glossWord(word, word, lang, otherLang(lang));
      setResult({ lang, data });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const saved = result && savedWords.isSaved(result.data.base_form);
  const add = async () => {
    if (!result || saved) return;
    const { lang, data } = result;
    try {
      const word = await savedWords.save({
        word: data.base_form,
        base_form: data.base_form,
        source_lang: lang,
        translation: data.translation,
        part_of_speech: data.part_of_speech,
        example_source: data.example_source,
        example_translation: data.example_translation,
      });
      onAdded(word);
      setText('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <form className="reader-addword" onSubmit={lookup}>
        <input
          className="reader-addword-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Любое слово на русском или английском"
          aria-label="Слово для колоды"
          maxLength={80}
        />
        <button type="submit" className="reader-btn-solid reader-btn-coral" disabled={busy || !text.trim()}>
          {busy ? 'Ищу…' : 'Найти перевод'}
        </button>
      </form>
      {error && <div className="reader-error">{error}</div>}
      {result && (
        <div className="reader-addword-result">
          <span className="reader-gloss-word-row">
            <span className="reader-gloss-word">{result.data.base_form}</span>
            <SpeakButton text={result.data.base_form} lang={result.lang} size={18} onError={onSpeakError} />
          </span>
          <div className="reader-gloss-pos">{result.data.part_of_speech}</div>
          <div className="reader-gloss-translation">{result.data.translation}</div>
          {result.data.example_source && (
            <div className="reader-gloss-example">
              <div>{result.data.example_source}</div>
              <div className="reader-gloss-example-tr">{result.data.example_translation}</div>
            </div>
          )}
          <button type="button" className={`reader-save-btn${saved ? ' saved' : ''}`} onClick={add} disabled={saved}>
            {saved ? 'В колоде ✓' : 'Добавить в колоду'}
          </button>
        </div>
      )}
    </>
  );
}

export default function FlashcardsPage({ savedWords }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [speakError, setSpeakError] = useState(null);

  useEffect(() => {
    api.listDueWords().then(setQueue).catch(() => setQueue([]));
  }, []);

  // The queue is a stack: the card being reviewed is always the front one.
  const current = queue && queue.length > 0 ? queue[0] : null;

  const grade = async (g) => {
    if (!current) return;
    await api.reviewWord(current.id, g);
    savedWords.load();
    setRevealed(false);
    // A miss sends the card to the back for another pass this session;
    // a hit just drops it off the front.
    setQueue((q) => (g === 'again' ? [...q.slice(1), current] : q.slice(1)));
  };

  return (
    <div className="reader-page reader-cards">
      <nav className="reader-subnav" aria-label="Читалка">
        <button type="button" className="reader-subnav-link" onClick={() => navigate('/reader')}>Библиотека</button>
        <span className="reader-subnav-active">Карточки</span>
      </nav>

      <h1 className="reader-h1">Повторение <span className="reader-accent-cyan">слов</span></h1>

      {/* New words are due right away, so they join this session's queue. */}
      <AddWord savedWords={savedWords} onAdded={(w) => setQueue((q) => (q ? [...q, w] : [w]))} onSpeakError={setSpeakError} />
      {speakError && <div className="reader-error">{speakError}</div>}

      {queue === null && <div className="reader-loading">Загрузка…</div>}

      {queue !== null && !current && (
        <div className="reader-cards-empty">
          <p>На сегодня повторять нечего — приходите позже, когда подойдёт срок.</p>
          <p className="reader-cards-empty-sub">Слов в колоде всего: {savedWords.words.length}</p>
        </div>
      )}

      {current && (
        <div className="reader-flashcard-wrap">
          <div className="reader-flashcard-progress">Осталось в этой сессии: {queue.length}</div>
          <button type="button" className="reader-flashcard" onClick={() => setRevealed((r) => !r)}>
            <span className="reader-flashcard-pos">{current.part_of_speech}</span>
            <span className="reader-flashcard-word">{revealed ? current.translation : current.base_form}</span>
            {revealed && current.example_source && (
              <span className="reader-flashcard-example">
                {current.example_source}
                {current.example_translation && <em>{current.example_translation}</em>}
              </span>
            )}
            {!revealed && <span className="reader-flashcard-hint">Нажмите, чтобы увидеть перевод</span>}
          </button>

          {/* Outside the card: it's a button itself, so these can't nest in it. */}
          <div className="reader-flashcard-wordrow">
            <SpeakButton text={current.base_form} lang={current.source_lang} size={18} label="Озвучить слово" onError={setSpeakError} />
            {revealed && <SpeakButton text={current.translation} lang={otherLang(current.source_lang)} size={18} label="Озвучить перевод" onError={setSpeakError} />}
          </div>

          {revealed && (
            <div className="reader-flashcard-actions">
              <button type="button" className="reader-btn-solid reader-btn-cream" onClick={() => grade('again')}>Не помню</button>
              <button type="button" className="reader-btn-solid reader-btn-coral" onClick={() => grade('good')}>Помню</button>
            </div>
          )}
        </div>
      )}

      <button type="button" className="reader-subnav-link reader-deck-toggle" onClick={() => setShowAll((s) => !s)}>
        {showAll ? 'Скрыть всю колоду' : `Показать всю колоду (${savedWords.words.length})`}
      </button>

      {showAll && (
        <div className="reader-deck-list">
          {savedWords.words.map((w) => (
            <div key={w.id} className="reader-deck-row">
              <div className="reader-deck-row-main">
                <span className="reader-deck-row-word">{w.base_form}</span>
                <span className="reader-deck-row-tr">{w.translation}</span>
              </div>
              <SpeakButton text={w.base_form} lang={w.source_lang} size={14} onError={setSpeakError} />
              <div className="reader-deck-row-bars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`reader-deck-bar${n <= w.familiarity ? ' filled' : ''}`} />
                ))}
              </div>
              <button type="button" className="reader-deck-row-delete" onClick={() => savedWords.remove(w.id)} aria-label="Удалить слово">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {savedWords.words.length === 0 && <div className="reader-cards-empty-sub">Колода пока пуста.</div>}
        </div>
      )}
    </div>
  );
}
