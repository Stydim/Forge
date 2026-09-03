import { Pencil } from 'lucide-react';

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

function EditButton({ task, onEdit }) {
  if (!onEdit) return null;
  return (
    <button className="task-card-icon-btn" onClick={() => onEdit(task)} aria-label="Изменить задачу">
      <Pencil size={16} />
    </button>
  );
}

export function UrgentTaskCard({ task, onDone, onSnooze, onSubtaskClick, onEdit }) {
  return (
    <div className="task-card urgent">
      <div className="task-card-row">
        <div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-meta">{task.meta}</div>
        </div>
        <div className="task-card-actions">
          <button className="btn-pill btn-pill-solid-red" onClick={() => onDone?.(task.id)}>
            Готово
          </button>
          <button className="btn-pill btn-pill-outline-red" onClick={() => onSnooze?.(task.id)}>
            +1 час
          </button>
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}

export function NormalTaskCard({ task, onDone, onSnooze, onSubtaskClick, onEdit }) {
  return (
    <div className="task-card">
      <div className="task-card-row">
        <div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-meta">{task.meta}</div>
        </div>
        <div className="task-card-actions">
          <button className="btn-pill btn-pill-outline-teal" onClick={() => onDone?.(task.id)}>
            Готово
          </button>
          <button className="btn-pill btn-pill-outline" onClick={() => onSnooze?.(task.id)}>
            Отложить
          </button>
          <EditButton task={task} onEdit={onEdit} />
        </div>
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}

export function ProgressTaskCard({ task, onSubtaskClick }) {
  return (
    <div className="task-card">
      <div className="task-card-row">
        <div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-meta">{task.meta}</div>
        </div>
        <div className="task-card-progress-badge">{task.progress}%</div>
      </div>
      <div className="task-progress-bar">
        <div className="task-progress-bar-fill" style={{ width: `${task.progress}%` }} />
      </div>
      <SubtaskChips subtasks={task.subtasks} onSubtaskClick={onSubtaskClick} />
    </div>
  );
}
