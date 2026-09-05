import { useEffect, useMemo, useRef, useState } from 'react';
import { UrgentTaskCard, NormalTaskCard, ProgressTaskCard } from '../components/TaskCard';
import GnomePanel from '../components/GnomePanel';
import StatsRow from '../components/StatsRow';
import { useStats } from '../hooks/useStats';
import { getCharacter, getCharacterState, DEFAULT_CHARACTER_ID } from '../lib/characters';
import { formatOverdue, formatUpcoming, formatDaysLeft, describeSnoozePattern, pluralRu } from '../lib/format';
import { parseTaskText, fetchGnomeLines } from '../lib/api';
import { getDialogue, setDialogue } from '../lib/dialogueCache';

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

export default function TasksPage({ tasks: tasksState, onEditTask, selectedTaskId, onSelectTask }) {
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

  // Which task/goal's dialogue is shown in the gnome panel (selectedTaskId
  // lives in App so it survives this page remounting). Defaults to the most
  // urgent one, but clicking any card (or snoozing it) switches to that task
  // specifically — its own title and its own snooze count, not the pack's.
  const autoFocusTask = useMemo(() => {
    const urgent = displayTasks.filter((t) => t.display === 'urgent');
    if (urgent.length) return urgent.sort((a, b) => b.snooze_count - a.snooze_count)[0];
    const snoozed = displayTasks.filter((t) => t.kind === 'task' && t.snooze_count > 0);
    if (snoozed.length) return snoozed.sort((a, b) => b.snooze_count - a.snooze_count)[0];
    return displayTasks[0] ?? null;
  }, [displayTasks]);

  const activeTask = useMemo(() => {
    const selected = selectedTaskId ? displayTasks.find((t) => t.id === selectedTaskId) : null;
    return selected ?? autoFocusTask;
  }, [selectedTaskId, displayTasks, autoFocusTask]);

  const { stage, lines: fallbackLines } = getCharacterState(character, activeTask);
  const [aiLines, setAiLines] = useState(null);
  const [aiFailed, setAiFailed] = useState(false);
  const requestKeyRef = useRef(null);

  useEffect(() => {
    if (!activeTask) {
      requestKeyRef.current = null;
      setAiLines(null);
      setAiFailed(false);
      return;
    }

    const key = `${activeTask.id}:${stage}`;
    const cached = getDialogue(activeTask.id);
    if (cached && cached.stage === stage) {
      requestKeyRef.current = key;
      setAiLines(cached.lines);
      setAiFailed(false);
      return;
    }

    if (requestKeyRef.current === key) return; // this exact combo is already in flight
    requestKeyRef.current = key;
    // Don't fall back to the static phrase here — that's what caused the
    // "old pinned phrase flashes, then the real one replaces it" flicker.
    // Show a loading state instead, and only use the static lines if the AI
    // call genuinely fails.
    setAiLines(null);
    setAiFailed(false);
    fetchGnomeLines({
      characterName: character.name,
      characterPower: character.power,
      characterHelps: character.helps,
      stage,
      taskTitle: activeTask.title,
      snoozeCount: activeTask.snooze_count,
    }).then((result) => {
      if (requestKeyRef.current !== key) return; // a newer request superseded this one
      if (result) {
        setDialogue(activeTask.id, stage, result);
        setAiLines(result);
      } else {
        setAiFailed(true);
      }
    });
  }, [activeTask, stage]);

  const linesLoading = activeTask && !aiLines && !aiFailed;
  const lines = aiLines ?? (aiFailed ? fallbackLines : []);
  const snoozeEcho = activeTask?.snooze_count
    ? `Отложено ${activeTask.snooze_count} ${pluralRu(activeTask.snooze_count, 'раз', 'раза', 'раз')}`
    : null;
  const caption = stats ? describeSnoozePattern(stats.hourBuckets) : null;

  const handleDone = (id) => { completeTask(id); reloadStats(); };
  const handleSnooze = (id) => { onSelectTask(id); snoozeTask(id); reloadStats(); };
  const handleSelect = (id) => onSelectTask(id);

  const [parsing, setParsing] = useState(false);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setParsing(true);
    const parsed = await parseTaskText(text);
    setParsing(false);
    if (parsed) {
      addTask({ title: parsed.title, due_at: parsed.due_at, dueHasTime: parsed.due_has_time });
    } else {
      addTask({ title: text });
    }
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
            const selected = task.id === activeTask?.id;
            if (task.display === 'urgent') {
              return (
                <UrgentTaskCard
                  key={task.id}
                  task={task}
                  onDone={handleDone}
                  onSnooze={handleSnooze}
                  onSubtaskClick={toggleSubtask}
                  onEdit={onEditTask}
                  onSelect={handleSelect}
                  selected={selected}
                />
              );
            }
            if (task.display === 'progress') {
              return (
                <ProgressTaskCard
                  key={task.id}
                  task={task}
                  onSubtaskClick={toggleSubtask}
                  onSelect={handleSelect}
                  selected={selected}
                />
              );
            }
            return (
              <NormalTaskCard
                key={task.id}
                task={task}
                onDone={handleDone}
                onSnooze={handleSnooze}
                onSubtaskClick={toggleSubtask}
                onEdit={onEditTask}
                onSelect={handleSelect}
                selected={selected}
              />
            );
          })}
        </div>

        <form className="task-add-row" onSubmit={handleAddSubmit}>
          <span>{parsing ? '…' : '+'}</span>
          <input
            className="task-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={parsing ? 'AI разбирает срок…' : 'Вставь сообщение, письмо или голосовое — AI разберёт срок сам'}
            disabled={parsing}
          />
        </form>

        <div style={{ height: 24 }} />

        <StatsRow stats={stats} loading={statsLoading} />
      </div>

      <GnomePanel
        character={character}
        activeTaskTitle={activeTask?.title}
        stage={stage}
        lines={lines}
        linesLoading={linesLoading}
        snoozeEcho={snoozeEcho}
        hourBuckets={stats?.hourBuckets}
        caption={caption}
      />
    </div>
  );
}
