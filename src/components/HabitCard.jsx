import { Pencil } from 'lucide-react';
import { DAY_LABELS } from '../lib/recurrence';
import { localDateKey } from '../lib/streaks';
import { calcHabitStreak, isHabitDueOn } from '../lib/habitStreak';
import { pluralRu } from '../lib/format';

const HISTORY_DAYS = 14;

export default function HabitCard({ habit, onToggleChip, onEdit }) {
  const todayKey = localDateKey(new Date().toISOString());
  const todayCount = habit.completions[todayKey] || 0;
  const streak = calcHabitStreak(habit);

  const daysLabel = habit.target_days && habit.target_days.length
    ? `по ${habit.target_days.map((d) => DAY_LABELS[d]).join(', ')}`
    : 'каждый день';
  const timesLabel = habit.times_per_day > 1 ? ` · ${habit.times_per_day} раз в день` : '';
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
        <button className="task-card-icon-btn" onClick={() => onEdit(habit)} aria-label="Изменить привычку">
          <Pencil size={16} />
        </button>
      </div>

      <div className="task-subtasks">
        {Array.from({ length: habit.times_per_day }, (_, i) => {
          const done = i < todayCount;
          return (
            <button
              key={i}
              className={`task-subtask-chip${done ? '' : ' pending'}`}
              style={done ? { background: habit.color, borderColor: habit.color, color: '#fff' } : undefined}
              onClick={() => onToggleChip(habit.id, todayKey, done ? i : i + 1)}
            >
              {i + 1}
            </button>
          );
        })}
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
