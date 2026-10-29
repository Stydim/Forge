import { useRef, useState } from 'react';
import {
  Award, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Flame, Lock, Plus, Star, TrendingUp, Zap,
} from 'lucide-react';
import HabitCard from '../components/HabitCard';
import HabitFormModal from '../components/HabitFormModal';
import HabitStatsModal from '../components/HabitStatsModal';
import HabitsOverviewModal from '../components/HabitsOverviewModal';
import { localDateKey } from '../lib/streaks';
import { calcHabitStreak, isHabitDueOn, habitProgress, todayKey } from '../lib/habitStreak';
import { HabitIconImg } from '../lib/habitIcons';
import '../habits.css';

const RING_C = 2 * Math.PI * 70;

const keyOf = (d) => localDateKey(d.toISOString());

// Sanct's "Идеальная неделя": some week in the last 13 where every due habit
// was fully done every (past) day.
function hasPerfectWeek(habits) {
  if (habits.length === 0) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for (let w = 0; w < 13; w++) {
    let perfect = true;
    let hasTarget = false;
    for (let i = 0; i < 7 && perfect; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() - w * 7 + i);
      if (date > now) break;
      const due = habits.filter((h) => isHabitDueOn(h.target_days, date));
      if (due.length === 0) continue;
      hasTarget = true;
      perfect = due.every((h) => (h.completions[keyOf(date)] || 0) >= h.times_per_day);
    }
    if (perfect && hasTarget) return true;
  }
  return false;
}

function buildBadges(everyHabit, activeHabits) {
  const maxStreak = everyHabit.length ? Math.max(...everyHabit.map(calcHabitStreak)) : 0;
  const total = everyHabit.reduce(
    (acc, h) => acc + Object.values(h.completions).filter((c) => c >= h.times_per_day).length, 0,
  );
  const step = (current, goal) => ({ current: Math.min(current, goal), total: goal });
  return [
    {
      id: 'first_spark', title: 'Утренняя искра', description: 'Первая привычка закрыта',
      detail: 'Ты сделал первый шаг! Каждое большое путешествие начинается с одного маленького действия.',
      Icon: Zap, color: '#E8B23A', unlocked: total >= 1, progress: step(total, 1),
    },
    {
      id: 'streak_7', title: 'Пик Архитектора', description: 'Стрик 7 дней подряд',
      detail: 'Семь дней без перерыва — ты начинаешь строить настоящую систему.',
      Icon: Flame, color: '#8B5CF6', unlocked: maxStreak >= 7, progress: step(maxStreak, 7),
    },
    {
      id: 'streak_14', title: 'Орбитальный разгон', description: 'Стрик 14 дней подряд',
      detail: '2 недели подряд — привычка начинает укореняться в нейронных связях.',
      Icon: TrendingUp, color: '#1B8A78', unlocked: maxStreak >= 14, progress: step(maxStreak, 14),
    },
    {
      id: 'perfect_week', title: 'Идеальная неделя', description: 'Все цели за одну неделю',
      detail: 'Ни одного пропуска за семь дней подряд. Космический уровень дисциплины!',
      Icon: Star, color: '#F6B93B', unlocked: hasPerfectWeek(activeHabits), progress: null,
    },
    {
      id: 'streak_30', title: 'Разжигатель', description: 'Стрик 30 дней подряд',
      detail: '30 дней — научно доказанный порог формирования привычки. Ты дошёл!',
      Icon: Award, color: '#E2604F', unlocked: maxStreak >= 30, progress: step(maxStreak, 30),
    },
    {
      id: 'completions_100', title: 'Цель Галактики', description: 'Выполнить привычки 100 раз',
      detail: '100 закрытых привычек — каждое повторение лепит лучшую версию тебя.',
      Icon: CheckCircle2, color: '#E8935A', unlocked: total >= 100, progress: step(total, 100),
    },
  ];
}

export default function HabitsPage({ habits: habitsState }) {
  const {
    habits, activeHabits, archivedHabits, loading, error,
    addHabit, updateHabit, deleteHabit, archiveHabit, toggleHabitDay,
  } = habitsState;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [statsHabitId, setStatsHabitId] = useState(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const listRef = useRef(null);
  const statsHabit = habits.find((h) => h.id === statsHabitId) ?? null;
  const endedHabits = habits.filter((h) => !activeHabits.includes(h));

  const openNewHabitModal = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

  const openEditHabitModal = (habit) => {
    setEditingHabit(habit);
    setModalOpen(true);
  };

  // Today's progress (hero ring).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tKey = todayKey();
  const todaysHabits = activeHabits.filter((h) => isHabitDueOn(h.target_days, today));
  const doneToday = todaysHabits.filter((h) => (h.completions[tKey] || 0) >= h.times_per_day).length;
  const percent = todaysHabits.length ? Math.round((doneToday / todaysHabits.length) * 100) : 0;

  // "Обзор регулярности": every day of the shown month up to today.
  const isCurrentMonth = month.year === today.getFullYear() && month.month === today.getMonth();
  const lastDay = isCurrentMonth ? today.getDate() : new Date(month.year, month.month + 1, 0).getDate();
  const monthDays = Array.from({ length: lastDay }, (_, i) => new Date(month.year, month.month, i + 1));
  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta) => setMonth(({ year, month: m }) => {
    const d = new Date(year, m + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const badges = buildBadges([...habits, ...archivedHabits], activeHabits);

  const renderCard = (habit) => (
    <HabitCard
      key={habit.id}
      habit={habit}
      onToggle={toggleHabitDay}
      onEdit={openEditHabitModal}
      onOpenStats={(h) => setStatsHabitId(h.id)}
    />
  );

  return (
    <div className="goals-page habits-page">
      <div className="goals-page-header">
        <div>
          <div className="page-date">ПРИВЫЧКИ</div>
          <h1 className="page-heading">Каждый день понемногу</h1>
        </div>
        <button className="goals-new-btn" onClick={openNewHabitModal}>+ Новая привычка</button>
      </div>

      {error && (
        <div className="task-card urgent" style={{ marginBottom: 16 }}>
          <div className="task-card-meta">Не удалось связаться с базой: {error}</div>
        </div>
      )}

      <div className="habits-card habits-hero">
        <div className="habits-hero-text">
          <div className="habits-hero-title">{percent}% выполнено!</div>
          <p className="habits-hero-sub">
            {todaysHabits.length
              ? `Сегодня ${doneToday} из ${todaysHabits.length}. Поддерживай темп и продолжай двигаться к целям. 🚀`
              : 'На сегодня привычек нет — можно отдохнуть.'}
          </p>
          <div className="habits-hero-actions">
            <button className="goals-new-btn" onClick={openNewHabitModal}><Plus size={16} /> Добавить привычку</button>
            <button className="habits-ghost-btn" onClick={() => setOverviewOpen(true)}>Открыть статистику</button>
          </div>
        </div>
        <div className="habits-ring">
          <svg viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="var(--bg-chip)" strokeWidth="16" />
            <circle
              cx="80" cy="80" r="70" fill="none" stroke="url(#habits-ring-gradient)" strokeWidth="16"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - percent / 100)}
              strokeLinecap="round" transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <defs>
              <linearGradient id="habits-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-amber)" />
                <stop offset="100%" stopColor="var(--accent-teal)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="habits-ring-center">
            <span className="habits-ring-value">{percent}%</span>
            <span className="habits-ring-label">Прогресс</span>
          </div>
        </div>
      </div>

      <div className="habits-grid">
        <div className="habits-card">
          <div className="habits-card-head">
            <div className="habits-card-heading">
              <Calendar size={22} className="habits-accent" />
              <div>
                <div className="habits-card-title">Обзор регулярности</div>
                <div className="habits-muted habits-capitalize">{monthLabel}</div>
              </div>
            </div>
            <div className="habits-month-nav">
              <button className="task-card-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={18} /></button>
              <button className="task-card-icon-btn" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="Следующий месяц"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="habits-heatmaps">
            {activeHabits.length === 0 ? (
              <div className="habits-muted">Нет активных привычек</div>
            ) : activeHabits.map((habit) => (
              <div key={habit.id}>
                <div className="habits-heatmap-name"><HabitIconImg icon={habit.icon} size={20} /> {habit.title}</div>
                <div className="habits-heatmap-row">
                  {monthDays.map((d) => {
                    const key = keyOf(d);
                    const due = isHabitDueOn(habit.target_days, d);
                    const score = due ? habitProgress(habit.completions[key] || 0, habit.times_per_day) : -1;
                    // Like Sanct: tap to toggle only within the current month.
                    const canToggle = due && isCurrentMonth;
                    const style = score > 0
                      ? { background: habit.color, opacity: 0.3 + score * 0.7, boxShadow: score === 1 ? `0 0 6px ${habit.color}66` : 'none' }
                      : { background: score === 0 ? 'var(--text-secondary)' : 'var(--bg-chip)', opacity: score === 0 ? 0.18 : 0.6 };
                    return (
                      <div
                        key={key}
                        className={`habits-heat-cell${canToggle ? ' clickable' : ''}`}
                        style={style}
                        onClick={() => canToggle && toggleHabitDay(habit.id, key)}
                        title={`${d.toLocaleDateString('ru-RU')} — ${score === -1 ? 'выходной' : `${Math.round(score * 100)}% выполнено`}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="habits-card-foot">
            <span>{isCurrentMonth ? 'Текущий месяц' : monthLabel}</span>
            {isCurrentMonth && <span className="habits-accent"><TrendingUp size={14} /> Отличный темп</span>}
          </div>
        </div>

        <div className="habits-card">
          <div className="habits-card-title" style={{ marginBottom: 16 }}>Быстрая отметка</div>
          <div className="habits-quick-list">
            {todaysHabits.length === 0 ? (
              <div className="habits-muted habits-quick-empty">Упс! На сегодня нет привычек. Отдохни!</div>
            ) : todaysHabits.slice(0, 4).map((habit) => {
              const count = habit.completions[tKey] || 0;
              const done = count >= habit.times_per_day;
              return (
                <div key={habit.id} className="habits-quick-row">
                  <button className="habits-quick-info" onClick={() => openEditHabitModal(habit)}>
                    <HabitIconImg icon={habit.icon} size={36} />
                    <span>
                      <span className="habits-quick-title">{habit.title}</span>
                      <span className="habits-muted">
                        {habit.times_per_day > 1 ? `${count}/${habit.times_per_day} раз` : (done ? 'Выполнено' : 'Не начинали')}
                      </span>
                    </span>
                  </button>
                  <button
                    className={`habits-quick-btn${done ? ' done' : ''}`}
                    onClick={() => toggleHabitDay(habit.id, tKey)}
                    aria-label={done ? 'Снять отметку' : 'Отметить выполнение'}
                  >
                    {done ? <CheckCircle2 size={24} /> : <Plus size={22} strokeWidth={3} />}
                  </button>
                </div>
              );
            })}
          </div>
          <button className="habits-ghost-btn habits-see-all" onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            Смотреть все привычки <ChevronDown size={16} />
          </button>
        </div>
      </div>

      <div className="habits-section-title" ref={listRef}>Все привычки</div>
      {!loading && habits.length === 0 && (
        <div className="archive-empty">Пока нет ни одной привычки — добавь первую.</div>
      )}
      <div className="task-list">{activeHabits.map(renderCard)}</div>

      {endedHabits.length > 0 && (
        <>
          <button className="habits-ended-toggle" onClick={() => setShowEnded((v) => !v)}>
            Завершённые · {endedHabits.length}
            <ChevronDown size={16} style={{ transform: showEnded ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showEnded && <div className="task-list habits-ended-list">{endedHabits.map(renderCard)}</div>}
        </>
      )}

      <div className="habits-section-title">Космические достижения</div>
      <div className="habits-badges">
        {badges.map((badge) => (
          <button
            key={badge.id}
            className={`habits-badge${badge.unlocked ? ' unlocked' : ''}`}
            style={{ '--badge-color': badge.color }}
            onClick={() => setSelectedBadge(badge)}
          >
            <div className="habits-badge-icon">
              {badge.unlocked ? <badge.Icon fill={badge.color} color={badge.color} size={26} /> : <Lock size={20} />}
            </div>
            <div className="habits-badge-title">{badge.title}</div>
            <div className="habits-badge-desc">{badge.description}</div>
            {badge.progress ? (
              <>
                <div className="habits-badge-bar">
                  <div style={{ width: `${(badge.progress.current / badge.progress.total) * 100}%` }} />
                </div>
                <div className="habits-badge-count">{badge.progress.current}/{badge.progress.total}</div>
              </>
            ) : (
              <div className="habits-badge-count">{badge.unlocked ? '✓ Выполнено' : '—'}</div>
            )}
          </button>
        ))}
      </div>

      {selectedBadge && (
        <div className="task-modal-overlay" onClick={() => setSelectedBadge(null)}>
          <div
            className={`task-modal habits-badge-modal${selectedBadge.unlocked ? ' unlocked' : ''}`}
            style={{ '--badge-color': selectedBadge.color }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="task-modal-close" onClick={() => setSelectedBadge(null)} aria-label="Закрыть">×</button>
            <div className="habits-badge-icon big">
              {selectedBadge.unlocked
                ? <selectedBadge.Icon fill={selectedBadge.color} color={selectedBadge.color} size={40} />
                : <Lock size={32} />}
            </div>
            <h2 className="task-modal-title">{selectedBadge.title}</h2>
            <p className="habits-muted">{selectedBadge.description}</p>
            <p className="habits-badge-detail">{selectedBadge.detail}</p>
            {selectedBadge.progress && (
              <div className="habits-badge-progress">
                <div className="habits-badge-progress-head">
                  <span>Прогресс</span>
                  <b>{selectedBadge.progress.current} / {selectedBadge.progress.total}</b>
                </div>
                <div className="habits-badge-bar big">
                  <div style={{ width: `${(selectedBadge.progress.current / selectedBadge.progress.total) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="habits-badge-status">
              {selectedBadge.unlocked ? '🏆 Разблокировано!' : (
                selectedBadge.progress
                  ? `Осталось: ${selectedBadge.progress.total - selectedBadge.progress.current}`
                  : '🔒 Ещё не достигнуто'
              )}
            </div>
          </div>
        </div>
      )}

      <HabitFormModal
        open={modalOpen}
        editingHabit={editingHabit}
        onClose={() => setModalOpen(false)}
        onCreate={addHabit}
        onUpdate={updateHabit}
        onDelete={deleteHabit}
        onArchive={archiveHabit}
      />

      {statsHabit && (
        <HabitStatsModal habit={statsHabit} onToggle={toggleHabitDay} onClose={() => setStatsHabitId(null)} />
      )}

      {overviewOpen && <HabitsOverviewModal habits={activeHabits} onClose={() => setOverviewOpen(false)} />}
    </div>
  );
}
