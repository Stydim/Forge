import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localDateKey } from '../lib/streaks';
import { isHabitDueOn, habitProgress, habitPieFill } from '../lib/habitStreak';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_LABEL_OPTS = { month: 'long', year: 'numeric' };

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export default function HabitStatsModal({ habit, onToggle, onClose }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();

  if (!habit) return null;

  const goPrev = () => setView(({ year, month }) => (
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  ));
  const goNext = () => setView(({ year, month }) => (
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  ));

  const { cells, targetCount, doneCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const grid = buildMonthGrid(view.year, view.month);
    let target = 0;
    let done = 0;
    const withState = grid.map((d) => {
      if (!d) return null;
      const isFuture = d > today;
      const due = !isFuture && isHabitDueOn(habit.target_days, d);
      const count = due ? (habit.completions[localDateKey(d.toISOString())] || 0) : 0;
      const progress = due ? habitProgress(count, habit.times_per_day) : 0;
      const isDone = progress >= 1;
      if (due) { target += 1; if (isDone) done += 1; }
      return { date: d, due, progress, isDone, isFuture, isToday: localDateKey(d.toISOString()) === localDateKey(today.toISOString()) };
    });
    return { cells: withState, targetCount: target, doneCount: done };
  }, [habit, view]);

  const rate = targetCount ? Math.round((doneCount / targetCount) * 100) : null;
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('ru-RU', MONTH_LABEL_OPTS);

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <div className="habit-stats-heading">
          <div className="habit-icon-badge" style={{ background: `${habit.color}22`, color: habit.color }}>
            {habit.icon || '⭐'}
          </div>
          <h2 className="task-modal-title">{habit.title}</h2>
        </div>

        <div className="habit-stats-month-nav">
          <button type="button" className="task-card-icon-btn" onClick={goPrev} aria-label="Предыдущий месяц">
            <ChevronLeft size={18} />
          </button>
          <span className="habit-stats-month-label">{monthLabel}</span>
          <button
            type="button"
            className="task-card-icon-btn"
            onClick={goNext}
            disabled={isCurrentMonth}
            aria-label="Следующий месяц"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="habit-stats-weekdays">
          {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
        </div>

        <div className="habit-stats-grid">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="habit-stats-cell empty" />;
            const classes = ['habit-stats-cell'];
            if (c.isToday) classes.push('today');
            if (!c.due && !c.isFuture) classes.push('off');
            if (c.isFuture) classes.push('future');
            if (c.due) classes.push('clickable');
            const dateKey = localDateKey(c.date.toISOString());
            return (
              <button
                key={i}
                type="button"
                className={classes.join(' ')}
                style={{ ...habitPieFill(c.progress, habit.color), color: c.isDone ? '#fff' : undefined }}
                disabled={!c.due}
                onClick={() => onToggle(habit.id, dateKey)}
                title={dateKey}
              >
                {c.date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="habit-stats-summary">
          {targetCount === 0
            ? 'В этом месяце для привычки не было запланированных дней.'
            : `${doneCount} из ${targetCount} дней выполнено · ${rate}%`}
        </div>
        <div className="habit-stats-hint">Кликни по дню, чтобы отметить или снять отметку задним числом.</div>
      </div>
    </div>
  );
}
