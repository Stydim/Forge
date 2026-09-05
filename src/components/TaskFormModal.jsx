import { useEffect, useState } from 'react';
import { buildRecurrenceNote } from '../lib/recurrence';

function toDateValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Пн' },
  { value: 'tue', label: 'Вт' },
  { value: 'wed', label: 'Ср' },
  { value: 'thu', label: 'Чт' },
  { value: 'fri', label: 'Пт' },
  { value: 'sat', label: 'Сб' },
  { value: 'sun', label: 'Вс' },
];

const END_OPTIONS = [
  { value: 'never', label: 'Никогда' },
  { value: 'count', label: 'После N раз' },
  { value: 'date', label: 'До даты' },
];

export default function TaskFormModal({ open, onClose, onCreate, onUpdate, editingTask }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [hasTime, setHasTime] = useState(true);
  const [repeat, setRepeat] = useState('none');
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [endType, setEndType] = useState('never');
  const [endCount, setEndCount] = useState(5);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setDueDate(toDateValue(editingTask.due_at));
      setDueTime(toTimeValue(editingTask.due_at));
      setHasTime(editingTask.due_at ? editingTask.due_has_time ?? true : true);
      setRepeat(editingTask.repeat_type || 'none');
      setSelectedDays(editingTask.repeat_days || []);
      setTimesPerDay(editingTask.times_per_day || 1);
      setEndType(editingTask.repeat_end_type || 'never');
      setEndCount(editingTask.repeat_occurrences_left || 5);
      setEndDate(toDateValue(editingTask.repeat_end_date));
    } else {
      setTitle('');
      setDueDate('');
      setDueTime('');
      setHasTime(true);
      setRepeat('none');
      setSelectedDays([]);
      setTimesPerDay(1);
      setEndType('never');
      setEndCount(5);
      setEndDate('');
    }
  }, [open, editingTask]);

  if (!open) return null;

  const toggleDay = (value) => {
    setSelectedDays((prev) => (
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    ));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const repeatEndType = repeat === 'none' ? 'never' : endType;
    const repeatEndDate = repeatEndType === 'date' && endDate ? new Date(endDate).toISOString() : null;
    const repeatCount = repeatEndType === 'count' ? endCount : null;

    const dueHasTime = dueDate ? hasTime : true;
    const due_at = dueDate ? new Date(`${dueDate}T${dueHasTime && dueTime ? dueTime : '00:00'}`).toISOString() : null;

    const payload = {
      title: title.trim(),
      due_at,
      dueHasTime,
      recurrence_note: buildRecurrenceNote(repeat, selectedDays, timesPerDay, repeatEndType, repeatCount, repeatEndDate),
      timesPerDay,
      repeatType: repeat,
      repeatDays: selectedDays,
      repeatEndType,
      repeatCount,
      repeatEndDate,
    };

    if (editingTask) onUpdate(editingTask.id, payload);
    else onCreate(payload);
    onClose();
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <h2 className="task-modal-title">{editingTask ? 'Изменить задачу' : 'Новая задача'}</h2>
        <p className="task-modal-subtitle">
          {editingTask ? 'Поправь текст, дату или повтор' : 'Опиши, что и когда, повтор — по желанию'}
        </p>

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
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ marginBottom: dueDate ? 12 : 20 }}
          />

          {dueDate && (
            <>
              <label className="task-modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={hasTime}
                  onChange={(e) => setHasTime(e.target.checked)}
                />
                Указать время
              </label>
              {hasTime && (
                <input
                  className="task-modal-input"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              )}
            </>
          )}

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

          {repeat !== 'none' && (
            <>
              <div className="task-modal-label">Когда закончить повтор</div>
              <div className="task-modal-end-grid">
                {END_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    className={`task-modal-repeat-btn${endType === opt.value ? ' active' : ''}`}
                    onClick={() => setEndType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {endType === 'count' && (
                <div className="task-modal-counter" style={{ marginBottom: 28 }}>
                  <button
                    type="button"
                    className="task-modal-counter-btn"
                    onClick={() => setEndCount((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <span className="task-modal-counter-value">{endCount}</span>
                  <button
                    type="button"
                    className="task-modal-counter-btn"
                    onClick={() => setEndCount((n) => Math.min(365, n + 1))}
                  >
                    +
                  </button>
                  <span className="task-modal-counter-suffix">повторов</span>
                </div>
              )}

              {endType === 'date' && (
                <input
                  className="task-modal-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ marginBottom: 28 }}
                />
              )}
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
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
}
