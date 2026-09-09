import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { pluralRu } from '../lib/format';

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

export function UrgentTaskCard({ task, onDone, onSnooze, onSubtaskClick, onEdit, onSelect, selected }) {
  return (
    <div className={`task-card urgent${selected ? ' selected' : ''}`} onClick={() => onSelect?.(task.id)}>
      <div className="task-card-row">
        <div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-meta">{task.meta}</div>
        </div>
        <div className="task-card-actions">
          <button className="btn-pill btn-pill-solid-red" onClick={() => onDone?.(task.id)}>
            Готово
          </button>
          <SnoozeButton task={task} onSnooze={onSnooze} className="btn-pill btn-pill-outline-red" label="Отложить" />
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}

export function NormalTaskCard({ task, onDone, onSnooze, onSubtaskClick, onEdit, onSelect, selected }) {
  return (
    <div className={`task-card${selected ? ' selected' : ''}`} onClick={() => onSelect?.(task.id)}>
      <div className="task-card-row">
        <div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-meta">{task.meta}</div>
        </div>
        <div className="task-card-actions">
          <button className="btn-pill btn-pill-outline-teal" onClick={() => onDone?.(task.id)}>
            Готово
          </button>
          <SnoozeButton task={task} onSnooze={onSnooze} className="btn-pill btn-pill-outline" label="Отложить" />
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}

export function ProgressTaskCard({ task, onSubtaskClick, onEdit, onSelect, selected }) {
  return (
    <div className={`task-card${selected ? ' selected' : ''}`} onClick={() => onSelect?.(task.id)}>
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
