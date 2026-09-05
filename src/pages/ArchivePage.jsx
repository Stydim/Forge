import { RotateCcw, Trash2 } from 'lucide-react';
import { useArchive } from '../hooks/useArchive';

function formatCompletedAt(iso) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const day = isToday
    ? 'Сегодня'
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `Выполнено: ${day}, ${time}`;
}

export default function ArchivePage({ onRestore }) {
  const { tasks, loading, error, restoreTask, deleteForever } = useArchive(onRestore);

  const handleDelete = (id, title) => {
    if (window.confirm(`Удалить «${title}» навсегда? Это нельзя отменить.`)) {
      deleteForever(id);
    }
  };

  return (
    <div className="archive-page">
      <div className="page-date">АРХИВ</div>
      <h1 className="page-heading">Выполненные задачи</h1>

      {error && (
        <div className="task-card urgent" style={{ marginBottom: 16 }}>
          <div className="task-card-meta">Не удалось связаться с базой: {error}</div>
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="archive-empty">Пока ничего не выполнено — готовые задачи будут появляться здесь.</div>
      )}

      <div className="archive-list">
        {tasks.map((task) => (
          <div key={task.id} className="archive-item">
            <div className="archive-item-info">
              <div className="archive-item-title">{task.title}</div>
              <div className="archive-item-meta">
                {formatCompletedAt(task.completed_at)}
                {task.recurrence_note ? ` · ${task.recurrence_note}` : ''}
              </div>
            </div>
            <div className="archive-item-actions">
              <button
                className="task-card-icon-btn"
                onClick={() => restoreTask(task.id)}
                aria-label="Восстановить"
                title="Восстановить"
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="task-card-icon-btn"
                onClick={() => handleDelete(task.id, task.title)}
                aria-label="Удалить навсегда"
                title="Удалить навсегда"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
