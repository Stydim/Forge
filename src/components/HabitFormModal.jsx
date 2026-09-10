import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Пн' },
  { value: 'tue', label: 'Вт' },
  { value: 'wed', label: 'Ср' },
  { value: 'thu', label: 'Чт' },
  { value: 'fri', label: 'Пт' },
  { value: 'sat', label: 'Сб' },
  { value: 'sun', label: 'Вс' },
];

const COLORS = ['#1B8A78', '#E2604F', '#E8935A', '#3B82C4', '#8B5CF6', '#EC7FA9'];

export default function HabitFormModal({ open, onClose, onCreate, onUpdate, onDelete, editingHabit }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmingDelete(false);
    if (editingHabit) {
      setTitle(editingHabit.title);
      setIcon(editingHabit.icon || '');
      setColor(editingHabit.color || COLORS[0]);
      setSelectedDays(editingHabit.target_days || []);
      setTimesPerDay(editingHabit.times_per_day || 1);
    } else {
      setTitle('');
      setIcon('');
      setColor(COLORS[0]);
      setSelectedDays([]);
      setTimesPerDay(1);
    }
  }, [open, editingHabit]);

  if (!open) return null;

  const toggleDay = (value) => {
    setSelectedDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = { title: title.trim(), icon, color, targetDays: selectedDays, timesPerDay };
    if (editingHabit) onUpdate(editingHabit.id, payload);
    else onCreate(payload);
    onClose();
  };

  const handleDelete = () => {
    onDelete(editingHabit.id);
    onClose();
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <h2 className="task-modal-title">{editingHabit ? 'Изменить привычку' : 'Новая привычка'}</h2>
        <p className="task-modal-subtitle">
          {editingHabit ? 'Поправь текст, дни или цвет' : 'Что хочешь делать регулярно'}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="task-modal-label" htmlFor="habit-modal-title-input">Текст привычки</label>
          <textarea
            id="habit-modal-title-input"
            className="task-modal-textarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Пить воду"
            rows={2}
            autoFocus
          />

          <label className="task-modal-label" htmlFor="habit-modal-icon-input">Эмодзи (по желанию)</label>
          <input
            id="habit-modal-icon-input"
            className="task-modal-input habit-icon-input"
            value={icon}
            onChange={(e) => setIcon([...e.target.value].slice(-1).join(''))}
            placeholder="💧"
          />

          <div className="task-modal-label">Цвет</div>
          <div className="habit-color-row">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`habit-color-swatch${color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>

          <div className="task-modal-label">По каким дням (пусто — каждый день)</div>
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

          <div className="task-modal-label">Количество повторов в день</div>
          <div className="task-modal-counter" style={{ marginBottom: 28 }}>
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

          {editingHabit && confirmingDelete ? (
            <div className="task-modal-delete-confirm">
              <span>Точно удалить привычку?</span>
              <button type="button" className="task-modal-btn-small" onClick={() => setConfirmingDelete(false)}>
                Нет
              </button>
              <button type="button" className="task-modal-btn-small danger" onClick={handleDelete}>
                Да, удалить
              </button>
            </div>
          ) : (
            <div className="task-modal-actions">
              <div className="task-modal-actions-left">
                {editingHabit && (
                  <button
                    type="button"
                    className="task-modal-delete-btn"
                    onClick={() => setConfirmingDelete(true)}
                    aria-label="Удалить привычку"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="task-modal-actions-right">
                <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
                <button type="submit" className="task-modal-btn save">Сохранить</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
