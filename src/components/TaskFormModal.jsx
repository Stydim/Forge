import { useState } from 'react';
import { pluralRu } from '../lib/format';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Без повтора' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'weekdays', label: 'По будням' },
  { value: 'weekends', label: 'По выходным' },
  { value: 'monthly', label: 'Каждый месяц' },
  { value: 'yearly', label: 'Ежегодно' },
  { value: 'custom_days', label: 'По дням недели' },
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

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Пн' },
  { value: 'tue', label: 'Вт' },
  { value: 'wed', label: 'Ср' },
  { value: 'thu', label: 'Чт' },
  { value: 'fri', label: 'Пт' },
  { value: 'sat', label: 'Сб' },
  { value: 'sun', label: 'Вс' },
];

function buildRecurrenceNote(repeat, selectedDays, timesPerDay) {
  let base = null;
  if (repeat === 'custom_days') {
    if (selectedDays.length > 0) {
      const labels = DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.value)).map((d) => d.label);
      base = `по ${labels.join(', ')}`;
    }
  } else if (repeat !== 'none') {
    base = REPEAT_NOTES[repeat];
  }

  if (timesPerDay > 1) {
    const timesText = `${timesPerDay} ${pluralRu(timesPerDay, 'раз', 'раза', 'раз')} в день`;
    base = base ? `${base} · ${timesText}` : timesText;
  }
  return base;
}

export default function TaskFormModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setDue('');
    setRepeat('none');
    setSelectedDays([]);
    setTimesPerDay(1);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleDay = (value) => {
    setSelectedDays((prev) => (
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    ));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      recurrence_note: buildRecurrenceNote(repeat, selectedDays, timesPerDay),
      timesPerDay,
      repeatType: repeat,
      repeatDays: selectedDays,
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

          {repeat === 'custom_days' && (
            <>
              <div className="task-modal-label">По каким дням</div>
              <div className="task-modal-days-row">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    type="button"
                    key={day.value}
                    className={`task-modal-day-btn${selectedDays.includes(day.value) ? ' active' : ''}`}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="task-modal-label">Количество повторов в день</div>
          <div className="task-modal-counter">
            <button
              type="button"
              className="task-modal-counter-btn"
              onClick={() => setTimesPerDay((n) => Math.max(1, n - 1))}
            >
              −
            </button>
            <span className="task-modal-counter-value">{timesPerDay}</span>
            <button
              type="button"
              className="task-modal-counter-btn"
              onClick={() => setTimesPerDay((n) => Math.min(10, n + 1))}
            >
              +
            </button>
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
