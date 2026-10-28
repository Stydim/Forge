import { createPortal } from 'react-dom';
import { Check, Pencil, Timer, X } from 'lucide-react';
import { formatDurationShort, openChecklistCount, priorityOf } from '../lib/taskDetails';

// Opens on a click on a task card: the task's notes (description), its
// checklist with items that can be ticked right here, category/tags/time,
// and quick actions. Ticks are saved immediately via onChecklistChange.
export default function TaskDetailsModal({ task, meta, timer, onClose, onChecklistChange, onEdit, onOpenTimer, onDone }) {
  const prio = task.priority && task.priority !== 'none' ? priorityOf(task.priority) : null;
  const category = task.category_id && meta?.categories.find((c) => c.id === task.category_id);
  const tags = (task.tags || []).map((name) => meta?.tags.find((t) => t.name === name) || { name, color: '#A39C88' });
  const checklist = task.checklist || [];
  const done = checklist.filter((c) => c.done).length;
  const spent = task.time_spent_seconds || 0;
  const target = task.time_target_minutes || 0;
  const timerHere = timer?.taskId === task.id;
  const openItems = openChecklistCount(task);

  const toggle = (id) => onChecklistChange(task.id, checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));

  return createPortal(
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal details-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={task.title}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>

        <h2 className="task-modal-title details-title">
          {prio && <span className="task-prio-dot" style={{ background: prio.color }} title={`Приоритет: ${prio.label.toLowerCase()}`} />}
          {task.title}
        </h2>
        <div className="details-meta">{task.meta}</div>

        {(category || tags.length > 0 || prio) && (
          <div className="task-card-details details-chips">
            {prio && <span className="task-detail-stat" style={{ color: prio.color }}>● {prio.label}</span>}
            {category && (
              <span className="task-detail-cat" style={{ color: category.color, borderColor: category.color }}>{category.icon} {category.name}</span>
            )}
            {tags.map((t) => <span key={t.name} className="task-detail-tag" style={{ background: t.color }}>{t.name}</span>)}
          </div>
        )}

        <div className="task-modal-label">Заметки</div>
        {task.description
          ? <div className="details-notes">{task.description}</div>
          : <button type="button" className="details-empty" onClick={() => onEdit(task)}>Заметок нет — добавить</button>}

        <div className="task-modal-label">
          Чек-лист{checklist.length > 0 && <span className="details-count"> · {done} из {checklist.length}</span>}
        </div>
        {checklist.length > 0 ? (
          <>
            <div className="timer-progress details-progress">
              <div className={`timer-progress-fill${done === checklist.length ? ' done' : ''}`} style={{ width: `${(done / checklist.length) * 100}%` }} />
            </div>
            <div className="details-checklist">
              {checklist.map((it) => (
                <button key={it.id} type="button" className={`details-check${it.done ? ' done' : ''}`} onClick={() => toggle(it.id)}>
                  <span className="td-check-box">{it.done && <Check size={13} />}</span>
                  <span className="details-check-title">{it.title}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button type="button" className="details-empty" onClick={() => onEdit(task)}>Пунктов нет — добавить</button>
        )}

        {(spent > 0 || target > 0 || timerHere) && (
          <div className="details-time">
            <Timer size={15} /> {formatDurationShort(spent)}{target > 0 && ` из ${formatDurationShort(target * 60)}`}
            {timerHere && <span className="details-time-live">{timer.startedAt ? '· таймер идёт' : '· таймер на паузе'}</span>}
          </div>
        )}

        <div className="task-modal-actions details-actions">
          <div className="task-modal-actions-left">
            <button type="button" className="task-modal-btn-small" onClick={() => onEdit(task)}><Pencil size={14} /> Изменить</button>
            <button type="button" className="task-modal-btn-small" onClick={() => onOpenTimer(task.id)}><Timer size={14} /> Таймер</button>
          </div>
          <div className="task-modal-actions-right">
            <button
              type="button"
              className="task-modal-btn save"
              onClick={() => onDone(task.id)}
              disabled={openItems > 0}
              title={openItems > 0 ? `Сначала отметьте все пункты чек-листа (осталось ${openItems})` : undefined}
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
