import { useEffect, useRef, useState } from 'react';
import { ListChecks, Pencil, Timer } from 'lucide-react';
import { pluralRu } from '../lib/format';
import { formatDurationShort, priorityOf } from '../lib/taskDetails';

// Title with the priority dot in front (none = no dot).
function CardTitle({ task }) {
  const prio = task.priority && task.priority !== 'none' ? priorityOf(task.priority) : null;
  return (
    <div className="task-card-title">
      {prio && <span className="task-prio-dot" style={{ background: prio.color }} title={`Приоритет: ${prio.label.toLowerCase()}`} />}
      {task.title}
    </div>
  );
}

// The task's details under its meta line: description, category, tags,
// checklist progress and tracked time.
function CardDetails({ task, meta }) {
  const category = task.category_id && meta?.categories.find((c) => c.id === task.category_id);
  const tags = (task.tags || []).map((name) => meta?.tags.find((t) => t.name === name) || { name, color: '#A39C88' });
  const checklist = task.checklist || [];
  const done = checklist.filter((c) => c.done).length;
  const spent = task.time_spent_seconds || 0;
  const target = task.time_target_minutes || 0;
  if (!task.description && !category && !tags.length && !checklist.length && !spent && !target) return null;
  return (
    <>
      {task.description && <div className="task-card-desc">{task.description}</div>}
      <div className="task-card-details">
        {category && (
          <span className="task-detail-cat" style={{ color: category.color, borderColor: category.color }}>
            {category.icon} {category.name}
          </span>
        )}
        {tags.map((t) => (
          <span key={t.name} className="task-detail-tag" style={{ background: t.color }}>{t.name}</span>
        ))}
        {checklist.length > 0 && (
          <span className={`task-detail-stat${done === checklist.length ? ' done' : ''}`} title="Чек-лист">
            <ListChecks size={13} /> {done}/{checklist.length}
          </span>
        )}
        {(spent > 0 || target > 0) && (
          <span className="task-detail-stat" title="Затрачено времени">
            <Timer size={13} /> {formatDurationShort(spent)}{target > 0 && ` / ${formatDurationShort(target * 60)}`}
          </span>
        )}
      </div>
    </>
  );
}

// Card click: selects the task (character panel) and, unless the click was
// on one of the card's own controls, opens its details.
const cardClick = (task, onSelect, onOpen) => (e) => {
  onSelect?.(task.id);
  if (onOpen && !e.target.closest('button, input, a, .snooze-menu-wrap')) onOpen(task.id);
};

function TimerButton({ task, timer, onOpenTimer }) {
  if (!onOpenTimer) return null;
  const mine = timer?.taskId === task.id;
  const state = mine ? (timer.startedAt ? ' running' : ' paused') : '';
  return (
    <button
      className={`task-card-icon-btn task-timer-btn${state}`}
      onClick={() => onOpenTimer(task.id)}
      aria-label="Трекер времени"
      title={mine ? (timer.startedAt ? 'Таймер идёт' : 'Таймер на паузе') : 'Трекер времени'}
    >
      <Timer size={16} />
    </button>
  );
}

function SubtaskChips({ subtasks, onSubtaskClick }) {
  if (!subtasks || subtasks.length === 0) return null;
  return (
    <div className="task-subtasks">
      {subtasks.map((s) => (
        <button
          key={s.id}
          className={`task-subtask-chip${s.active ? ' active' : s.done ? '' : ' pending'}`}
          onClick={() => onSubtaskClick?.(s.id, !s.done)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, onChange, min, max }) {
  return (
    <div className="snooze-menu-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

function SnoozeButton({ task, onSnooze, className, label }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(1);
  const [days, setDays] = useState(1);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const confirm = (totalHours) => {
    onSnooze?.(task.id, totalHours);
    setOpen(false);
  };

  return (
    <div className="snooze-menu-wrap" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <button className={className} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && (
        <div className="snooze-menu">
          <div className="snooze-menu-row">
            <Stepper value={hours} onChange={setHours} min={1} max={23} />
            <button type="button" className="snooze-menu-confirm" onClick={() => confirm(hours)}>
              на {hours} {pluralRu(hours, 'час', 'часа', 'часов')}
            </button>
          </div>
          <div className="snooze-menu-row">
            <Stepper value={days} onChange={setDays} min={1} max={30} />
            <button type="button" className="snooze-menu-confirm" onClick={() => confirm(days * 24)}>
              на {days} {pluralRu(days, 'день', 'дня', 'дней')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditButton({ task, onEdit }) {
  if (!onEdit) return null;
  return (
    <button className="task-card-icon-btn" onClick={() => onEdit(task)} aria-label="Изменить задачу">
      <Pencil size={16} />
    </button>
  );
}

export function UrgentTaskCard({ task, onDone, onSnooze, onSubtaskClick, onEdit, onSelect, selected, meta, timer, onOpenTimer, onOpen }) {
  return (
    <div className={`task-card urgent${selected ? ' selected' : ''}${onOpen ? ' openable' : ''}`} data-task-id={task.id} onClick={cardClick(task, onSelect, onOpen)}>
      <div className="task-card-row">
        <div className="task-card-main">
          <CardTitle task={task} />
          <div className="task-card-meta">{task.meta}</div>
          <CardDetails task={task} meta={meta} />
        </div>
        <div className="task-card-actions">
          <button className="btn-pill btn-pill-solid-red" onClick={() => onDone?.(task.id)}>
            Готово
          </button>
          <SnoozeButton task={task} onSnooze={onSnooze} className="btn-pill btn-pill-outline-red" label="Отложить" />
          <TimerButton task={task} timer={timer} onOpenTimer={onOpenTimer} />
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}

export function NormalTaskCard({ task, onDone, onSnooze, onSubtaskClick, onEdit, onSelect, selected, meta, timer, onOpenTimer, onOpen }) {
  return (
    <div className={`task-card${selected ? ' selected' : ''}${onOpen ? ' openable' : ''}`} data-task-id={task.id} onClick={cardClick(task, onSelect, onOpen)}>
      <div className="task-card-row">
        <div className="task-card-main">
          <CardTitle task={task} />
          <div className="task-card-meta">{task.meta}</div>
          <CardDetails task={task} meta={meta} />
        </div>
        <div className="task-card-actions">
          <button className="btn-pill btn-pill-outline-teal" onClick={() => onDone?.(task.id)}>
            Готово
          </button>
          <SnoozeButton task={task} onSnooze={onSnooze} className="btn-pill btn-pill-outline" label="Отложить" />
          <TimerButton task={task} timer={timer} onOpenTimer={onOpenTimer} />
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}

export function ProgressTaskCard({ task, onSubtaskClick, onEdit, onSelect, selected }) {
  return (
    <div className={`task-card${selected ? ' selected' : ''}`} data-task-id={task.id} onClick={() => onSelect?.(task.id)}>
      <div className="task-card-row">
        <div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-meta">{task.meta}</div>
        </div>
        <div className="task-card-actions">
          <div className="task-card-progress-badge">{task.progress}%</div>
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <div className="task-progress-bar">
        <div className="task-progress-bar-fill" style={{ width: `${task.progress}%` }} />
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}
