import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import * as api from '../lib/api';

export default function FlashcardsPage({ savedWords }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
