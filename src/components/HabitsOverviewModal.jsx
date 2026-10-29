import { useMemo } from 'react';
import { localDateKey } from '../lib/streaks';
import { isHabitDueOn, habitProgress } from '../lib/habitStreak';
import { HabitIconImg } from '../lib/habitIcons';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DONUT_R = 70;
const DONUT_C = 2 * Math.PI * DONUT_R;

// Sanct's "Статистика привычек (за 30 дней)": share of due days done,
// success rate by weekday, and the best / weakest habits. A partly done day
// counts as its fraction (1 of 2 = 0.5).
export default function HabitsOverviewModal({ habits, onClose }) {
  const stats = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (29 - i));
      return d;
    });
    let target = 0;
    let done = 0;
    const weekdays = Array.from({ length: 7 }, () => ({ target: 0, done: 0 }));
    const perHabit = habits.map((habit) => {
      let hTarget = 0;
      let hDone = 0;
      for (const d of days) {
        if (!isHabitDueOn(habit.target_days, d)) continue;
        const score = habitProgress(habit.completions[localDateKey(d.toISOString())] || 0, habit.times_per_day);
        const wd = (d.getDay() + 6) % 7;
        hTarget += 1; hDone += score;
        weekdays[wd].target += 1; weekdays[wd].done += score;
      }
      return { habit, rate: hTarget ? (hDone / hTarget) * 100 : 0, hTarget };
    }).filter((h) => h.hTarget > 0);
    target = perHabit.reduce((s, h) => s + h.hTarget, 0);
    done = weekdays.reduce((s, w) => s + w.done, 0);
    const sorted = [...perHabit].sort((a, b) => b.rate - a.rate);
    const top = sorted.slice(0, 3);
    const bottom = sorted.slice(-3).reverse().filter((h) => !top.includes(h));
    return {
      target,
      done,
      top,
      bottom,
      weekdayRates: weekdays.map((w) => (w.target ? Math.round((w.done / w.target) * 100) : 0)),
    };
  }, [habits]);

  const share = stats.target ? stats.done / stats.target : 0;

  const list = (items, empty) => (items.length === 0 ? <div className="habits-muted">{empty}</div> : (
    <div className="habits-rank-list">
      {items.map(({ habit, rate }) => (
        <div key={habit.id} className="habits-rank-row">
          <span className="habits-rank-name"><HabitIconImg icon={habit.icon} size={20} /> {habit.title}</span>
          <b>{Math.round(rate)}%</b>
        </div>
      ))}
    </div>
  ));

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal habits-overview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <h2 className="task-modal-title">Статистика привычек</h2>
        <p className="task-modal-subtitle">За последние 30 дней</p>

        {stats.target === 0 ? (
          <div className="habits-muted">Пока нет данных — добавь привычку и отмечай выполнение.</div>
        ) : (
          <>
            <div className="habits-overview-grid">
              <div className="habits-panel">
                <div className="habits-panel-title">Доля успеха</div>
                <div className="habits-donut">
                  <svg viewBox="0 0 180 180">
                    <circle cx="90" cy="90" r={DONUT_R} fill="none" stroke="var(--bg-chip)" strokeWidth="26" />
                    <circle
                      cx="90" cy="90" r={DONUT_R} fill="none" stroke="var(--accent-teal)" strokeWidth="26"
                      strokeDasharray={`${DONUT_C * share} ${DONUT_C}`} transform="rotate(-90 90 90)"
                    />
                  </svg>
                  <div className="habits-donut-center">{Math.round(share * 100)}%</div>
                </div>
                <div className="habits-legend">
                  <span><i style={{ background: 'var(--accent-teal)' }} /> Выполнено {Math.round(stats.done)}</span>
                  <span><i style={{ background: 'var(--bg-chip)' }} /> Упущено {Math.round(stats.target - stats.done)}</span>
                </div>
              </div>

              <div className="habits-panel">
                <div className="habits-panel-title">Активность по дням недели</div>
                <div className="habits-bars">
                  {stats.weekdayRates.map((rate, i) => (
                    <div key={WEEKDAY_LABELS[i]} className="habits-bar-col" title={`${rate}% выполнено`}>
                      <span className="habits-bar-value">{rate}%</span>
                      <div className="habits-bar-track"><div className="habits-bar-fill" style={{ height: `${rate}%` }} /></div>
                      <span className="habits-bar-label">{WEEKDAY_LABELS[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="habits-overview-grid">
              <div className="habits-panel">
                <div className="habits-panel-title good">🏆 Топ привычек</div>
                {list(stats.top, 'Недостаточно данных')}
              </div>
              <div className="habits-panel">
                <div className="habits-panel-title bad">⚠️ Требуют внимания</div>
                {list(stats.bottom, 'Все привычки выполняются отлично!')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
