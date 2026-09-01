import { useState } from 'react';
import { UrgentTaskCard, NormalTaskCard, ProgressTaskCard } from '../components/TaskCard';
import GnomePanel from '../components/GnomePanel';
import StatsRow from '../components/StatsRow';

const initialTasks = [
  {
    id: 1,
    kind: 'urgent',
    title: 'Витамины',
    meta: 'Просрочено 40 минут · 5-е напоминание · отложено 4 раза',
  },
  {
    id: 2,
    kind: 'normal',
    title: 'Показания счётчика',
    meta: 'Сегодня, 20:00 · ежемесячно 19-го',
  },
  {
    id: 3,
    kind: 'progress',
    title: 'Запустить лендинг',
    meta: '8 дней до срока · 2 из 3 шагов',
    progress: 66,
    subtasks: [
      { label: 'Собрать структуру', done: true },
      { label: 'Написать тексты', done: true },
      { label: 'Свести на мобильном', done: false, active: true },
    ],
  },
];

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

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [lang, setLang] = useState('ru');

  const overdueCount = tasks.filter((t) => t.kind === 'urgent').length;
  const heading =
    overdueCount > 0
      ? `${tasks.length === 1 ? 'Одно дело' : `${tasks.length} дела`}. ${
          overdueCount === 1 ? 'Одно уже просит внимания.' : `${overdueCount} уже просят внимания.`
        }`
      : 'Все дела под контролем.';

  const completeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const snoozeTask = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, meta: `${t.meta} · отложено` } : t))
    );

  return (
    <div className="tasks-page">
      <div className="tasks-main">
        <div className="page-topline">
          <div>
            <div className="page-date">{dateLabel}</div>
            <h1 className="page-heading">{heading}</h1>
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

        <div className="task-list">
          {tasks.map((task) => {
            if (task.kind === 'urgent') {
              return <UrgentTaskCard key={task.id} task={task} onDone={completeTask} onSnooze={snoozeTask} />;
            }
            if (task.kind === 'progress') {
              return <ProgressTaskCard key={task.id} task={task} />;
            }
            return <NormalTaskCard key={task.id} task={task} onDone={completeTask} onSnooze={snoozeTask} />;
          })}
        </div>

        <button className="task-add-row">
          + Вставь сообщение, письмо или голосовое — AI разберёт срок сам
        </button>

        <div style={{ height: 24 }} />

        <StatsRow streak={12} streakRecord={24} onTimeRate={86} avgSnoozes="2,4" />
      </div>

      <GnomePanel stage={5} messages={gnomeMessages} />
    </div>
  );
}
