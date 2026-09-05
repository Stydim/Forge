import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

function toDateValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GoalFormModal({ open, editingGoal, onClose, onCreate, onUpdate }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [steps, setSteps] = useState([{ id: null, label: '' }]);

  useEffect(() => {
    if (!open) return;
    if (editingGoal) {
      setTitle(editingGoal.title);
      setDueDate(toDateValue(editingGoal.due_at));
      setSteps(
        editingGoal.subtasks.length
          ? editingGoal.subtasks.map((s) => ({ id: s.id, label: s.label }))
          : [{ id: null, label: '' }],
      );
    } else {
      setTitle('');
      setDueDate('');
      setSteps([{ id: null, label: '' }]);
    }
  }, [open, editingGoal]);

  if (!open) return null;

  const updateStep = (i, value) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, label: value } : s)));
  };

  const removeStep = (i) => {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const addStep = () => setSteps((prev) => [...prev, { id: null, label: '' }]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      due_at: dueDate ? new Date(`${dueDate}T00:00`).toISOString() : null,
      steps,
    };
    if (editingGoal) onUpdate(editingGoal.id, payload);
    else onCreate(payload);
    onClose();
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <h2 className="task-modal-title">{editingGoal ? 'Изменить цель' : 'Новая цель'}</h2>
        <p className="task-modal-subtitle">
          {editingGoal ? 'Поправь текст, срок или шаги' : 'Опиши цель, срок и шаги к ней — по желанию'}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="task-modal-label" htmlFor="goal-modal-title-input">Текст цели</label>
          <textarea
            id="goal-modal-title-input"
            className="task-modal-textarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Запустить лендинг"
            rows={2}
            autoFocus
          />

          <label className="task-modal-label" htmlFor="goal-modal-due-input">Срок</label>
          <input
            id="goal-modal-due-input"
            className="task-modal-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <div className="task-modal-label">Шаги</div>
          <div className="goal-steps-list">
            {steps.map((step, i) => (
              <div key={i} className="goal-step-row">
                <input
                  className="task-modal-input goal-step-input"
                  value={step.label}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Шаг ${i + 1}`}
                />
                {steps.length > 1 && (
                  <button type="button" className="task-card-icon-btn" onClick={() => removeStep(i)} aria-label="Убрать шаг">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="goal-add-step-btn" onClick={addStep}>+ Добавить шаг</button>

          <div className="task-modal-actions">
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
}
