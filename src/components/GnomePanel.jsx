import { Link } from 'react-router-dom';
import { pluralRu } from '../lib/format';

// The escalation stage (1 + times the task was snoozed) as a tone anyone can
// read, instead of a bare "СТУПЕНЬ N". Stages past the last one stay "На пределе".
const TONES = ['Спокоен', 'Напоминает', 'Ворчит', 'Сердится', 'На пределе'];

export default function GnomePanel({ character, activeTask, onShowTask, stage, lines, linesLoading, snoozeEcho, hourBuckets, caption }) {
  const maxVal = Math.max(1, ...(hourBuckets ?? []));
  const level = stage ? Math.min(stage, TONES.length) : 0;
  const snoozes = activeTask?.snooze_count ?? 0;
  const toneHint = stage
    ? `Тон персонажа: становится строже с каждым откладыванием этой задачи. ${snoozes
      ? `Отложено ${snoozes} ${pluralRu(snoozes, 'раз', 'раза', 'раз')}.`
      : 'Её пока не откладывали.'}`
    : 'Нет задач, о которых стоит напомнить.';

  return (
    <aside className="gnome-panel">
      <div className="gnome-panel-header">
        <div className="gnome-panel-title-row">
          <img className="gnome-panel-avatar" src={character.avatar} alt="" />
          <div className="gnome-panel-title">{character.name}</div>
        </div>
        <div className={`gnome-tone tone-${level}`} title={toneHint} aria-label={toneHint}>
          <span className="gnome-tone-dots" aria-hidden="true">
            {TONES.map((_, i) => <span key={i} className={`gnome-tone-dot${i < level ? ' on' : ''}`} />)}
          </span>
          {stage ? TONES[level - 1] : 'Всё чисто'}
        </div>
      </div>

      {activeTask && (
        <button type="button" className="gnome-about" onClick={() => onShowTask?.(activeTask.id)} title="Показать задачу в списке">
          <span className="gnome-about-label">О задаче</span>
          <span className="gnome-about-title">{activeTask.title}</span>
        </button>
      )}

      <div className="gnome-chat">
        {linesLoading ? (
          <div className="gnome-bubble loading">
            <span className="gnome-typing-dot" />
            <span className="gnome-typing-dot" />
            <span className="gnome-typing-dot" />
          </div>
        ) : (
          lines.map((text, i) => (
            <div key={i} className="gnome-bubble">
              {text}
            </div>
          ))
        )}
        {snoozeEcho && <div className="gnome-bubble user">{snoozeEcho}</div>}
      </div>

      {hourBuckets && (
        <>
          <div className="snooze-chart-label">Откладывания по часам</div>
          <div className="snooze-chart">
            {hourBuckets.map((v, i) => (
              <div
                key={i}
                className={`snooze-bar${v >= maxVal ? ' high' : ''}`}
                style={{ height: `${(v / maxVal) * 100}%` }}
              />
            ))}
          </div>
          <div className="snooze-chart-caption">
            {caption ?? 'Пока нет данных об откладываниях — и это хорошо.'}
          </div>
        </>
      )}

      <Link to="/characters" className="gnome-switch-btn">Сменить персонажа</Link>
    </aside>
  );
}
