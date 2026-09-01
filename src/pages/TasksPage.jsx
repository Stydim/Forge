import { useMemo, useState } from 'react';
import { UrgentTaskCard, NormalTaskCard, ProgressTaskCard } from '../components/TaskCard';
import GnomePanel from '../components/GnomePanel';
import StatsRow from '../components/StatsRow';
import { useTasks } from '../hooks/useTasks';
import { formatOverdue, formatUpcoming, formatDaysLeft, pluralRu } from '../lib/format';

const gnomeMessages = [
  { from: 'gnome', text: 'Витамины ждут с девяти. Это твой список, не мой.' },
  { from: 'gnome', text: 'Ладно, молчу. Тебе виднее, я всего лишь гном.' },
  { from: 'user', text: 'Отложено на 1 час' },
];

const dateLabel = new Date().toLocaleDateString('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).toUpperCase();

function deriveDisplay(task) {
  if (task.kind === 'goal') {
    const total = task.subtasks.length;
    const done = task.subtasks.filter((s) => s.done).length;
    const firstPendingIndex = task.subtasks.findIndex((s) => !s.done);
    const subtasks = task.subtasks.map((s, i) => ({ ...s, active: i === firstPendingIndex }));
    const meta = task.due_at
      ? `${formatDaysLeft(task.due_at)} · ${done} из ${total} шагов`
      : `${done} из ${total} шагов`;
    return { ...task, subtasks, progress: total ? Math.round((done / total) * 100) : 0, meta, display: 'progress' };
  }

  const overdue = task.due_at && new Date(task.due_at).getTime() < Date.now();
  if (overdue) {
    const snoozePart = task.snooze_count
      ? ` · отложено ${task.snooze_count} ${pluralRu(task.snooze_count, 'раз', 'раза', 'раз')}`
      : '';
    return {
      ...task,
      meta: `${formatOverdue(task.due_at)} · ${task.reminder_count}-е напоминание${snoozePart}`,
      display: 'urgent',
    };
  }

  return {
    ...task,
    meta: task.due_at ? formatUpcoming(task.due_at, task.recurrence_note) : 'Без срока',
    display: 'normal',
  };
}

export default function TasksPage() {
  const { tasks, loading, error, completeTask, snoozeTask, toggleSubtask, addTask } = useTasks();
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

  const handleAddSubmit = (e) => {
    e.preventDefault();
    addTask(draft);
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
              return <UrgentTaskCard key={task.id} task={task} onDone={completeTask} onSnooze={snoozeTask} />;
            }
            if (task.display === 'progress') {
              return <ProgressTaskCard key={task.id} task={task} onSubtaskClick={toggleSubtask} />;
            }
            return <NormalTaskCard key={task.id} task={task} onDone={completeTask} onSnooze={snoozeTask} />;
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

        <StatsRow streak={12} streakRecord={24} onTimeRate={86} avgSnoozes="2,4" />
      </div>

      <GnomePanel stage={5} messages={gnomeMessages} />
    </div>
  );
}
