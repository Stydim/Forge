import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, Square, Timer, X } from 'lucide-react';
import { sessionSeconds, useNow } from '../hooks/useTaskTimer';
import { formatClock, formatDurationShort } from '../lib/taskDetails';

const PRESETS = [15, 25, 45, 60, 90, 120];
const presetLabel = (m) => (m < 60 ? `${m} мин` : m % 60 ? `${m / 60} ч` : `${m / 60} ч`);

// Time tracker for one task: start/pause/stop, a target with presets, and
// how much time the task has taken in total.
export function TaskTimerModal({ task, timerApi, onClose, onSetTarget }) {
  const { timer, running, start, pause, stop, reset } = timerApi;
  const mine = timer?.taskId === task.id;
  const now = useNow(mine && running);
  const session = mine ? sessionSeconds(timer, now) : 0;
  const target = task.time_target_minutes || 0;
  const total = (task.time_spent_seconds || 0) + session;
  const progress = target ? Math.min(100, (total / (target * 60)) * 100) : 0;
  const reached = target && total >= target * 60;

  return createPortal(
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal timer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        <div className="timer-modal-eyebrow"><Timer size={14} /> Трекер времени</div>
        <h2 className="task-modal-title timer-modal-title">{task.title}</h2>

        <div className={`timer-clock${mine && running ? ' running' : ''}`}>{formatClock(session)}</div>
        <div className="timer-sub">
          Всего на задачу: <b>{formatDurationShort(total)}</b>
          {target > 0 && <> из {formatDurationShort(target * 60)}</>}
        </div>
        {target > 0 && (
          <div className="timer-progress"><div className={`timer-progress-fill${reached ? ' done' : ''}`} style={{ width: `${progress}%` }} /></div>
        )}
        {reached && <div className="timer-reached">Цель по времени достигнута 🎉</div>}

        <div className="timer-controls">
          {mine && running ? (
            <button type="button" className="timer-btn" onClick={pause}><Pause size={18} /> Пауза</button>
          ) : (
            <button type="button" className="timer-btn primary" onClick={() => start(task.id)}>
              <Play size={18} /> {mine ? 'Продолжить' : 'Старт'}
            </button>
          )}
          {mine && (
            <>
              <button type="button" className="timer-btn" onClick={() => { stop(); onClose(); }} title="Остановить и записать время">
                <Square size={16} /> Стоп
              </button>
              <button type="button" className="timer-btn ghost" onClick={reset} title="Сбросить, не записывая">
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </div>
        {timer && !mine && <div className="timer-note">Сейчас идёт таймер другой задачи — при старте он остановится и сохранится.</div>}

        <div className="task-modal-label">Цель по времени</div>
        <div className="timer-presets">
          {PRESETS.map((m) => (
            <button key={m} type="button" className={`td-chip${target === m ? ' active' : ''}`} onClick={() => onSetTarget(task.id, target === m ? null : m)}>
              {presetLabel(m)}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Pill pinned to the bottom of the screen while a task's timer exists, on
// any page; click opens the full timer.
export function FloatingTimer({ task, timerApi, onOpen }) {
  const { timer, running, start, pause, stop } = timerApi;
  const now = useNow(running);
  if (!timer || !task) return null;
  const session = sessionSeconds(timer, now);
  return (
    <div className="floating-timer" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <span className={`floating-timer-dot${running ? ' running' : ''}`} />
      <span className="floating-timer-title">{task.title}</span>
      <span className="floating-timer-clock">{formatClock(session)}</span>
      <button
        type="button"
        className="floating-timer-btn"
        onClick={(e) => { e.stopPropagation(); if (running) pause(); else start(task.id); }}
        aria-label={running ? 'Пауза' : 'Продолжить'}
      >
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button type="button" className="floating-timer-btn" onClick={(e) => { e.stopPropagation(); stop(); }} aria-label="Остановить и записать">
        <Square size={13} />
      </button>
    </div>
  );
}
