export function UrgentTaskCard({ task, onDone, onSnooze }) {
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
        </div>
      </div>
    </div>
  );
}

export function NormalTaskCard({ task, onDone, onSnooze }) {
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
        </div>
      </div>
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
      <div className="task-subtasks">
        {task.subtasks.map((s, i) => (
          <button
            key={i}
            className={`task-subtask-chip${s.active ? ' active' : ''}`}
            onClick={() => onSubtaskClick?.(task.id, i)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
