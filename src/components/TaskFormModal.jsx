import { useState } from 'react';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Без повтора' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'weekdays', label: 'По будням' },
  { value: 'weekends', label: 'По выходным' },
  { value: 'monthly', label: 'Каждый месяц' },
  { value: 'yearly', label: 'Ежегодно' },
];

const REPEAT_NOTES = {
  none: null,
  daily: 'ежедневно',
  weekly: 'еженедельно',
  weekdays: 'по будням',
  weekends: 'по выходным',
  monthly: 'ежемесячно',
  yearly: 'ежегодно',
};

export default function TaskFormModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState('none');

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setDue('');
    setRepeat('none');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      recurrence_note: REPEAT_NOTES[repeat],
    });
    reset();
    onClose();
  };

  return (
    <div className="task-modal-overlay" onClick={handleClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={handleClose} aria-label="Закрыть">×</button>

        <h2 className="task-modal-title">Новая задача</h2>
        <p className="task-modal-subtitle">Опиши, что и когда, повтор — по желанию</p>

        <form onSubmit={handleSubmit}>
          <label className="task-modal-label" htmlFor="task-modal-title-input">Текст задачи</label>
          <textarea
            id="task-modal-title-input"
            className="task-modal-textarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Полить цветы"
            rows={2}
            autoFocus
          />

          <label className="task-modal-label" htmlFor="task-modal-due-input">Срок</label>
          <input
            id="task-modal-due-input"
            className="task-modal-input"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />

          <div className="task-modal-label">Повтор</div>
          <div className="task-modal-repeat-grid">
            {REPEAT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={`task-modal-repeat-btn${repeat === opt.value ? ' active' : ''}`}
                onClick={() => setRepeat(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="task-modal-actions">
            <button type="button" className="task-modal-btn cancel" onClick={handleClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
}
