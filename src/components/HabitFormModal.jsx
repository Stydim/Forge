import { useEffect, useState } from 'react';
import { Archive, Trash2, X } from 'lucide-react';
import { HABIT_ICONS, HabitIconImg, isIconKey, normalizeIcon } from '../lib/habitIcons';
import { localDateKey } from '../lib/streaks';

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

// Sanct's end-date presets — research-backed habit-forming horizons.
const END_DATE_PRESETS = [
  {
    days: 65,
    label: '65 дней',
    tooltip: 'В среднем привычка начинает формироваться и становиться относительно автоматической за 59–66 дней (примерно 2 месяца).',
  },
  {
    days: 150,
    label: '150 дней',
    tooltip: 'Для полного закрепления (максимальной автоматизации) часто требуется от 106 до 154 дней (3–5 месяцев).',
  },
];

function dateInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateKey(d.toISOString());
}

export default function HabitFormModal({ open, onClose, onCreate, onUpdate, onDelete, onArchive, editingHabit }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [endDate, setEndDate] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmingDelete(false);
    if (editingHabit) {
      setTitle(editingHabit.title);
      setIcon(normalizeIcon(editingHabit.icon));
      setColor(editingHabit.color || COLORS[0]);
      setSelectedDays(editingHabit.target_days || []);
      setTimesPerDay(editingHabit.times_per_day || 1);
      setEndDate(editingHabit.end_date || '');
    } else {
      setTitle('');
      setIcon('');
      setColor(COLORS[0]);
      setSelectedDays([]);
      setTimesPerDay(1);
      setEndDate('');
    }
  }, [open, editingHabit]);

  if (!open) return null;

  const toggleDay = (value) => {
    setSelectedDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = { title: title.trim(), icon, color, targetDays: selectedDays, timesPerDay, endDate };
    if (editingHabit) onUpdate(editingHabit.id, payload);
    else onCreate(payload);
    onClose();
  };

  const handleArchive = () => {
    onArchive(editingHabit.id);
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

          <div className="task-modal-label">Иконка</div>
          <div className="habit-icon-grid">
            {HABIT_ICONS.map(({ key }) => (
              <button
                type="button"
                key={key}
                className={`habit-icon-option${icon === key ? ' active' : ''}`}
                onClick={() => setIcon(icon === key ? '' : key)}
                aria-label={key}
              >
                <HabitIconImg icon={key} size={34} />
              </button>
            ))}
          </div>

          <label className="task-modal-label" htmlFor="habit-modal-icon-input">Или своё эмодзи</label>
          <input
            id="habit-modal-icon-input"
            className="task-modal-input habit-icon-input"
            value={isIconKey(icon) ? '' : icon}
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
          <div className="task-modal-counter" style={{ marginBottom: 20 }}>
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

          <div className="task-modal-label">Дата завершения</div>
          <div className="habit-end-row">
            {END_DATE_PRESETS.map(({ days, label, tooltip }) => {
              const target = dateInDays(days);
              return (
                <button
                  type="button"
                  key={days}
                  title={tooltip}
                  className={`habit-end-chip${endDate === target ? ' active' : ''}`}
                  onClick={() => setEndDate(endDate === target ? '' : target)}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              title="Привычка будет активна без ограничения по времени"
              className={`habit-end-chip${!endDate ? ' active' : ''}`}
              onClick={() => setEndDate('')}
            >
              Бесконечно
            </button>
          </div>
          <div className="habit-end-custom">
            <input
              type="date"
              className="task-modal-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Своя дата завершения"
            />
            {endDate && (
              <button type="button" className="task-card-icon-btn" onClick={() => setEndDate('')} aria-label="Сбросить дату" title="Сбросить дату">
                <X size={16} />
              </button>
            )}
          </div>

          {editingHabit && confirmingDelete ? (
            <div className="task-modal-delete-confirm">
              <span>Удалить привычку навсегда вместе с историей?</span>
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
                  <>
                    <button
                      type="button"
                      className="task-modal-delete-btn habit-archive-btn"
                      onClick={handleArchive}
                      aria-label="В архив"
                      title="В архив"
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      type="button"
                      className="task-modal-delete-btn"
                      onClick={() => setConfirmingDelete(true)}
                      aria-label="Удалить привычку"
                      title="Удалить навсегда"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
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
