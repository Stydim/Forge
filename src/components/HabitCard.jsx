import { CheckCircle2, Pencil, Plus } from 'lucide-react';
import { DAY_LABELS } from '../lib/recurrence';
import { localDateKey } from '../lib/streaks';
import { calcHabitStreak, isHabitDueOn } from '../lib/habitStreak';
import { pluralRu } from '../lib/format';

const HISTORY_DAYS = 14;

export default function HabitCard({ habit, onToggle, onEdit }) {
  const todayKey = localDateKey(new Date().toISOString());
  const todayCount = habit.completions[todayKey] || 0;
  const isCompleted = todayCount >= habit.times_per_day;
  const streak = calcHabitStreak(habit);

  const daysLabel = habit.target_days && habit.target_days.length
    ? `по ${habit.target_days.map((d) => DAY_LABELS[d]).join(', ')}`
    : 'каждый день';
  const timesLabel = habit.times_per_day > 1 ? ` · ${todayCount}/${habit.times_per_day} раз` : '';
  const streakLabel = streak > 0 ? ` · 🔥 ${streak} ${pluralRu(streak, 'день', 'дня', 'дней')}` : '';

  const history = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d.toISOString());
    const due = isHabitDueOn(habit.target_days, d);
    const count = habit.completions[key] || 0;
    history.push({ key, due, done: due && count >= habit.times_per_day, isToday: i === 0 });
  }

  return (
    <div className="task-card habit-card">
      <div className="task-card-row">
        <div className="habit-card-heading">
          <div className="habit-icon-badge" style={{ background: `${habit.color}22`, color: habit.color }}>
            {habit.icon || '⭐'}
          </div>
          <div>
            <div className="task-card-title">{habit.title}</div>
            <div className="task-card-meta">{daysLabel}{timesLabel}{streakLabel}</div>
          </div>
        </div>
        <div className="task-card-actions">
          <button
            className={`habit-checkin-btn${isCompleted ? ' done' : ''}`}
            style={isCompleted ? { color: habit.color, background: `${habit.color}18` } : undefined}
            onClick={() => onToggle(habit.id, todayKey)}
            aria-label={isCompleted ? 'Выполнено' : 'Отметить выполнение'}
          >
            {isCompleted ? <CheckCircle2 size={22} /> : <Plus size={20} strokeWidth={2.5} />}
          </button>
          <button className="task-card-icon-btn" onClick={() => onEdit(habit)} aria-label="Изменить привычку">
            <Pencil size={16} />
          </button>
        </div>
      </div>

      <div className="habit-history-row">
        {history.map((d) => (
          <div
            key={d.key}
            className={`habit-history-day${d.due ? '' : ' off'}${d.isToday ? ' today' : ''}`}
            style={d.done ? { background: habit.color } : undefined}
            title={d.key}
          />
        ))}
      </div>
    </div>
  );
}
