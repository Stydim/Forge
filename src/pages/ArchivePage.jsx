import { useMemo, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useArchive } from '../hooks/useArchive';
import { pluralRu } from '../lib/format';

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
  const { tasks, loading, error, restoreTask, deleteForever, deleteMany } = useArchive(onRestore);
  const [selected, setSelected] = useState(() => new Set());

  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  };

  const handleDelete = (id, title) => {
    if (window.confirm(`Удалить «${title}» навсегда? Это нельзя отменить.`)) {
      deleteForever(id);
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleDeleteSelected = () => {
    const count = selected.size;
    if (window.confirm(`Удалить ${count} ${count === 1 ? 'задачу' : 'задач'} навсегда? Это нельзя отменить.`)) {
      deleteMany([...selected]);
      setSelected(new Set());
    }
  };

  const selectedText = useMemo(() => {
    const n = selected.size;
    return `Выбрано: ${n} ${pluralRu(n, 'задача', 'задачи', 'задач')}`;
  }, [selected]);

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

      {tasks.length > 0 && (
        <div className="archive-toolbar">
          <label className="archive-select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Выбрать все
          </label>

          {selected.size > 0 && (
            <div className="archive-bulk-bar">
              <span>{selectedText}</span>
              <button className="btn-pill btn-pill-solid-red" onClick={handleDeleteSelected}>
                Удалить выбранное
              </button>
              <button className="btn-pill btn-pill-outline" onClick={() => setSelected(new Set())}>
                Отменить
              </button>
            </div>
          )}
        </div>
      )}

      <div className="archive-list">
        {tasks.map((task) => (
          <div key={task.id} className={`archive-item${selected.has(task.id) ? ' selected' : ''}`}>
            <input
              type="checkbox"
              className="archive-item-checkbox"
              checked={selected.has(task.id)}
              onChange={() => toggleOne(task.id)}
            />
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
