import { useEffect, useRef, useState } from 'react';
import { Timer, Trash2 } from 'lucide-react';
import { CategoryPicker, ChecklistEditor, EmojiRow, PriorityPicker, TagPicker } from './TaskDetailsFields';
import { formatDurationShort } from '../lib/taskDetails';
import { buildRecurrenceNote } from '../lib/recurrence';
import { resolveDueAtWithoutTime } from '../lib/dueDate';

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

export default function TaskFormModal({ open, onClose, onCreate, onUpdate, onDelete, editingTask, meta }) {
  const [title, setTitle] = useState('');
  // Details ported from Sanct.
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('none');
  const [categoryId, setCategoryId] = useState(null);
  const [tags, setTags] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [timeTarget, setTimeTarget] = useState('');
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const lastFieldRef = useRef('title'); // where the emoji row inserts
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [hasTime, setHasTime] = useState(true);
  const [repeat, setRepeat] = useState('none');
  const [selectedDays, setSelectedDays] = useState([]);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [endType, setEndType] = useState('never');
  const [endCount, setEndCount] = useState(5);
  const [endDate, setEndDate] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmingDelete(false);
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
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority || 'none');
      setCategoryId(editingTask.category_id || null);
      setTags(editingTask.tags || []);
      setChecklist(editingTask.checklist || []);
      setTimeTarget(editingTask.time_target_minutes ? String(editingTask.time_target_minutes) : '');
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
      setDescription('');
      setPriority('none');
      setCategoryId(null);
      setTags([]);
      setChecklist([]);
      setTimeTarget('');
    }
    lastFieldRef.current = 'title';
  }, [open, editingTask]);

  if (!open) return null;

  // Inserts an emoji at the caret of the last-focused text field.
  const insertEmoji = (emoji) => {
    const isDesc = lastFieldRef.current === 'description';
    const el = isDesc ? descRef.current : titleRef.current;
    const value = isDesc ? description : title;
    const set = isDesc ? setDescription : setTitle;
    const start = el && document.activeElement === el ? el.selectionStart : value.length;
    const end = el && document.activeElement === el ? el.selectionEnd : value.length;
    set(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

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
    // No time given: for a brand-new task (or one whose date actually
    // changed) today defaults to right now and any future date to 09:00 —
    // see resolveDueAtWithoutTime. But if we're just re-saving an existing
    // no-time task on the SAME date, keep its original moment instead of
    // bumping it forward on every edit.
    const keepOriginalNoTimeMoment = editingTask
      && !editingTask.due_has_time
      && toDateValue(editingTask.due_at) === dueDate;
    const due_at = !dueDate
      ? null
      : dueHasTime && dueTime
        ? new Date(`${dueDate}T${dueTime}`).toISOString()
        : keepOriginalNoTimeMoment
          ? editingTask.due_at
          : resolveDueAtWithoutTime(dueDate).toISOString();

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
      description,
      priority,
      categoryId,
      tags,
      checklist,
      timeTargetMinutes: Math.max(0, parseInt(timeTarget, 10) || 0),
    };

    if (editingTask) onUpdate(editingTask.id, payload);
    else onCreate(payload);
    onClose();
  };

  const handleDelete = () => {
    onDelete(editingTask.id);
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
            ref={titleRef}
            className="task-modal-textarea td-with-emoji"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => { lastFieldRef.current = 'title'; }}
            placeholder="Например: Полить цветы"
            rows={2}
            autoFocus
          />
          <EmojiRow onPick={insertEmoji} />

          <label className="task-modal-label" htmlFor="task-modal-desc-input">Описание</label>
          <textarea
            id="task-modal-desc-input"
            ref={descRef}
            className="task-modal-textarea td-with-emoji"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => { lastFieldRef.current = 'description'; }}
            placeholder="Детали, ссылки, заметки — по желанию"
            rows={2}
          />
          <EmojiRow onPick={insertEmoji} />

          <div className="task-modal-label">Приоритет</div>
          <PriorityPicker value={priority} onChange={setPriority} />

          {meta && (
            <>
              <div className="task-modal-label">Категория</div>
              <CategoryPicker categories={meta.categories} value={categoryId} onChange={setCategoryId} meta={meta} />

              <div className="task-modal-label">Теги</div>
              <TagPicker tags={meta.tags} value={tags} onChange={setTags} meta={meta} />
            </>
          )}

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

          <div className="task-modal-label">Чек-лист</div>
          <ChecklistEditor items={checklist} onChange={setChecklist} />

          <div className="task-modal-label">Время на задачу</div>
          <div className="td-time-row">
            <Timer size={16} />
            <span>Цель</span>
            <input
              className="task-modal-input td-time-input"
              type="number"
              min="0"
              max="1440"
              inputMode="numeric"
              value={timeTarget}
              onChange={(e) => setTimeTarget(e.target.value)}
              placeholder="—"
            />
            <span>мин</span>
            {editingTask?.time_spent_seconds > 0 && (
              <span className="td-time-spent">потрачено {formatDurationShort(editingTask.time_spent_seconds)}</span>
            )}
          </div>

          {editingTask && confirmingDelete ? (
            <div className="task-modal-delete-confirm">
              <span>Точно удалить задачу?</span>
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
                {editingTask && (
                  <button
                    type="button"
                    className="task-modal-delete-btn"
                    onClick={() => setConfirmingDelete(true)}
                    aria-label="Удалить задачу"
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
