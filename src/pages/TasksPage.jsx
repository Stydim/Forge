import { useMemo, useState } from 'react';
import { UrgentTaskCard, NormalTaskCard, ProgressTaskCard } from '../components/TaskCard';
import GnomePanel from '../components/GnomePanel';
import StatsRow from '../components/StatsRow';
import { useStats } from '../hooks/useStats';
import { getCharacter, getCharacterState, DEFAULT_CHARACTER_ID } from '../lib/characters';
import { formatOverdue, formatUpcoming, formatDaysLeft, describeSnoozePattern, pluralRu } from '../lib/format';

const character = getCharacter(DEFAULT_CHARACTER_ID);

const dateLabel = new Date().toLocaleDateString('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).toUpperCase();

function annotateSubtasks(subtasks) {
  const firstPendingIndex = subtasks.findIndex((s) => !s.done);
  return subtasks.map((s, i) => ({ ...s, active: i === firstPendingIndex }));
}

function deriveDisplay(task) {
  if (task.kind === 'goal') {
    const subtasks = annotateSubtasks(task.subtasks);
    const total = subtasks.length;
    const done = subtasks.filter((s) => s.done).length;
    const meta = task.due_at
      ? `${formatDaysLeft(task.due_at)} · ${done} из ${total} шагов`
      : `${done} из ${total} шагов`;
    return { ...task, subtasks, progress: total ? Math.round((done / total) * 100) : 0, meta, display: 'progress' };
  }

  const subtasks = task.subtasks?.length ? annotateSubtasks(task.subtasks) : task.subtasks;

  const overdue = task.due_at && new Date(task.due_at).getTime() < Date.now();
  if (overdue) {
    const snoozePart = task.snooze_count
      ? ` · отложено ${task.snooze_count} ${pluralRu(task.snooze_count, 'раз', 'раза', 'раз')}`
      : '';
    return {
      ...task,
      subtasks,
      meta: `${formatOverdue(task.due_at)} · ${task.reminder_count}-е напоминание${snoozePart}`,
      display: 'urgent',
    };
  }

  return {
    ...task,
    subtasks,
    meta: task.due_at ? formatUpcoming(task.due_at, task.recurrence_note, task.due_has_time) : 'Без срока',
    display: 'normal',
  };
}

export default function TasksPage({ tasks: tasksState, onEditTask }) {
  const { tasks, loading, error, completeTask, snoozeTask, toggleSubtask, addTask } = tasksState;
  const { stats, loading: statsLoading, reload: reloadStats } = useStats();
  const [lang, setLang] = useState('ru');
  const [draft, setDraft] = useState('');

  const displayTasks = useMemo(() => tasks.map(deriveDisplay), [tasks]);
  const overdueCount = displayTasks.filter((t) => t.display === 'urgent').length;

  const heading = displayTasks.length === 0
    ? 'Все дела под контролем.'
    : `${displayTasks.length} ${pluralRu(displayTasks.length, 'дело', 'дела', 'дел')}. ${
        overdueCount === 0
          ? 'Всё по расписанию.'
          : overdueCount === 1
            ? 'Одно уже просит внимания.'
            : `${overdueCount} уже просят внимания.`
      }`;

  const focusTask = useMemo(() => {
    const urgent = displayTasks.filter((t) => t.display === 'urgent');
    if (urgent.length) return urgent.sort((a, b) => b.snooze_count - a.snooze_count)[0];
    const snoozed = displayTasks.filter((t) => t.kind === 'task' && t.snooze_count > 0);
    return snoozed.sort((a, b) => b.snooze_count - a.snooze_count)[0] ?? null;
  }, [displayTasks]);

  const { stage, lines } = getCharacterState(character, focusTask);
  const snoozeEcho = focusTask?.snooze_count
    ? `Отложено ${focusTask.snooze_count} ${pluralRu(focusTask.snooze_count, 'раз', 'раза', 'раз')}`
    : null;
  const caption = stats ? describeSnoozePattern(stats.hourBuckets) : null;

  const handleDone = (id) => { completeTask(id); reloadStats(); };
  const handleSnooze = (id) => { snoozeTask(id); reloadStats(); };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    addTask({ title: draft });
    setDraft('');
  };

  return (
    <div className="tasks-page">
      <div className="tasks-main">
        <div className="page-topline">
          <div>
            <div className="page-date">{dateLabel}</div>
            <h1 className="page-heading">{loading ? 'Загрузка…' : heading}</h1>
          </div>
          <div className="lang-toggle">
            <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>
              RU
            </button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>

        {error && (
          <div className="task-card urgent" style={{ marginBottom: 16 }}>
            <div className="task-card-meta">Не удалось связаться с базой: {error}</div>
          </div>
        )}

        <div className="task-list">
          {displayTasks.map((task) => {
            if (task.display === 'urgent') {
              return (
                <UrgentTaskCard
                  key={task.id}
                  task={task}
                  onDone={handleDone}
                  onSnooze={handleSnooze}
                  onSubtaskClick={toggleSubtask}
                  onEdit={onEditTask}
                />
              );
            }
            if (task.display === 'progress') {
              return <ProgressTaskCard key={task.id} task={task} onSubtaskClick={toggleSubtask} />;
            }
            return (
              <NormalTaskCard
                key={task.id}
                task={task}
                onDone={handleDone}
                onSnooze={handleSnooze}
                onSubtaskClick={toggleSubtask}
                onEdit={onEditTask}
              />
            );
          })}
        </div>

        <form className="task-add-row" onSubmit={handleAddSubmit}>
          <span>+</span>
          <input
            className="task-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Вставь сообщение, письмо или голосовое — AI разберёт срок сам"
          />
        </form>

        <div style={{ height: 24 }} />

        <StatsRow stats={stats} loading={statsLoading} />
      </div>

      <GnomePanel
        character={character}
        stage={stage}
        lines={lines}
        snoozeEcho={snoozeEcho}
        hourBuckets={stats?.hourBuckets}
        caption={caption}
      />
    </div>
  );
}
