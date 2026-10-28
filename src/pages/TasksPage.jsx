import { useEffect, useMemo, useRef, useState } from 'react';
import { DAY_MS } from '../lib/streaks';
import { UrgentTaskCard, NormalTaskCard, ProgressTaskCard } from '../components/TaskCard';
import GnomePanel from '../components/GnomePanel';
import StatsRow from '../components/StatsRow';
import { useStats } from '../hooks/useStats';
import { getCharacter, getCharacterState } from '../lib/characters';
import { formatOverdue, formatUpcoming, formatDaysLeft, describeSnoozePattern, pluralRu } from '../lib/format';
import { parseTaskText, fetchGnomeLines } from '../lib/api';
import { getDialogue, setDialogue } from '../lib/dialogueCache';
import { buildRecurrenceNote } from '../lib/recurrence';
import { resolveDueAtWithoutTime, dateKey } from '../lib/dueDate';

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
    // (No "N-е напоминание" here: reminder_count is a leftover from the early
    // mock-ups — nothing ever increments it, so it always read "0-е".)
    return {
      ...task,
      subtasks,
      meta: `${formatOverdue(task.due_at)}${snoozePart}`,
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

export default function TasksPage({ tasks: tasksState, onEditTask, selectedTaskId, onSelectTask, activeCharacterId, taskMeta, timer, onOpenTimer }) {
  const { tasks, loading, error, completeTask, snoozeTask, toggleSubtask, addTask } = tasksState;
  const { stats, loading: statsLoading, reload: reloadStats } = useStats();
  const character = getCharacter(activeCharacterId);
  const [lang, setLang] = useState('ru');
  const [draft, setDraft] = useState('');

  const displayTasks = useMemo(() => tasks.map(deriveDisplay), [tasks]);
  // Category filter for the list (ported from Sanct): 'all', or a category id.
  const [categoryFilter, setCategoryFilter] = useState('all');
  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const t of displayTasks) if (t.category_id) counts.set(t.category_id, (counts.get(t.category_id) || 0) + 1);
    return counts;
  }, [displayTasks]);
  const usedCategories = (taskMeta?.categories || []).filter((c) => categoryCounts.has(c.id));
  const activeFilter = categoryFilter !== 'all' && categoryCounts.has(categoryFilter) ? categoryFilter : 'all';
  const listTasks = activeFilter === 'all' ? displayTasks : displayTasks.filter((t) => t.category_id === activeFilter);
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

    // Whether the task has actually come due yet — a not-yet-due task
    // shouldn't get nagged at like it's overdue just because "stage" (driven
    // only by snooze_count) happens to be 1. Also doubles as part of the
    // cache key so a task quietly crossing into "overdue" while sitting
    // untouched (no snooze) still gets a fresh, appropriately-toned line.
    //
    // Overdue is split by how long (under a day, 1-3 days, 3-7 days, over a
    // week): the line is cached and shown for days, so it must not quote an
    // exact duration ("три часа висит долг" next to a card saying 33 hours),
    // but its tone should still harden as the debt ages — a new bucket gets
    // a fresh line.
    const overdueMs = activeTask.due_at ? Date.now() - new Date(activeTask.due_at).getTime() : null;
    const dueBucket = overdueMs == null
      ? 'none'
      : overdueMs < 0 ? 'upcoming'
        : overdueMs < DAY_MS ? 'overdue-hours'
          : overdueMs < 3 * DAY_MS ? 'overdue-days'
            : overdueMs < 7 * DAY_MS ? 'overdue-week'
              : 'overdue-long';
    const dueStatus = {
      none: 'без срока',
      upcoming: `срок ещё не наступил — ${formatUpcoming(activeTask.due_at, null, activeTask.due_has_time)}`,
      'overdue-hours': 'просрочено недавно, меньше суток',
      'overdue-days': 'просрочено уже пару дней',
      'overdue-week': 'просрочено несколько дней, почти неделю',
      'overdue-long': 'просрочено больше недели, давно',
    }[dueBucket];

    const key = `${character.id}:${activeTask.id}:${stage}:${dueBucket}`;
    if (requestKeyRef.current === key) return; // this exact combo is shown / in flight
    requestKeyRef.current = key;

    // The server keeps one dialogue per character+task for all devices and
    // only generates a new one when stage or due bucket changes. The local
    // copy just shows instantly while the server is asked; if the server
    // already holds a different line for this situation (made on another
    // device), that one wins and replaces the local copy.
    const cached = getDialogue(character.id, activeTask.id);
    const localHit = cached && cached.stage === stage && cached.dueBucket === dueBucket;
    // Without a local copy, show a loading state rather than the static
    // phrase — swapping a static phrase for the real one read as a flicker.
    setAiLines(localHit ? cached.lines : null);
    setAiFailed(false);
    fetchGnomeLines({
      characterId: character.id,
      taskId: activeTask.id,
      dueBucket,
      knownLines: localHit ? cached.lines : undefined,
      characterName: character.name,
      characterPower: character.power,
      characterHelps: character.helps,
      stage,
      taskTitle: activeTask.title,
      snoozeCount: activeTask.snooze_count,
      dueStatus,
    }).then((result) => {
      if (requestKeyRef.current !== key) return; // a newer request superseded this one
      if (result) {
        setDialogue(character.id, activeTask.id, stage, result, dueBucket);
        setAiLines(result);
      } else if (!localHit) {
        setAiFailed(true);
      }
    });
  }, [activeTask, stage, character]);

  const linesLoading = activeTask && !aiLines && !aiFailed;
  const lines = aiLines ?? (aiFailed ? fallbackLines : []);
  const snoozeEcho = activeTask?.snooze_count
    ? `Отложено ${activeTask.snooze_count} ${pluralRu(activeTask.snooze_count, 'раз', 'раза', 'раз')}`
    : null;
  const caption = stats ? describeSnoozePattern(stats.hourBuckets) : null;

  // Stats are re-read only after the change is saved, or the tiles and the
  // chart would lag one action behind the cards.
  const handleDone = async (id) => { await completeTask(id); reloadStats(); };
  const handleSnooze = async (id, hours) => { onSelectTask(id); await snoozeTask(id, hours); reloadStats(); };
  const handleSelect = (id) => onSelectTask(id);
  // From the character panel: scroll the dialogue's task into view and pulse it.
  const showTaskCard = (id) => {
    const card = document.querySelector(`[data-task-id="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('task-card-pulse');
    void card.offsetWidth; // restart the animation
    card.classList.add('task-card-pulse');
  };

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
      const repeatType = parsed.repeat_type || 'none';
      const repeatDays = repeatType === 'custom_days' ? parsed.repeat_days : null;
      const timesPerDay = parsed.times_per_day || 1;
      const repeatEndType = parsed.repeat_end_type || 'never';
      const repeatCount = repeatEndType === 'count' ? parsed.repeat_count : null;
      const repeatEndDate = repeatEndType === 'date' ? parsed.repeat_end_date : null;
      // Grok isn't told what time to use when none was mentioned, so its
      // guess for due_at is unreliable whenever due_has_time is false —
      // recompute from just the date, same rule as manual creation (today
      // → now, future → 09:00) instead of trusting whatever time it picked.
      let dueAt = parsed.due_at;
      if (dueAt && parsed.due_has_time === false) {
        dueAt = resolveDueAtWithoutTime(dateKey(new Date(dueAt))).toISOString();
      }
      addTask({
        title: parsed.title,
        due_at: dueAt,
        dueHasTime: parsed.due_has_time,
        recurrence_note: buildRecurrenceNote(repeatType, repeatDays, timesPerDay, repeatEndType, repeatCount, repeatEndDate),
        timesPerDay,
        repeatType,
        repeatDays,
        repeatEndType,
        repeatCount,
        repeatEndDate,
      });
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

        {usedCategories.length > 0 && (
          <div className="task-filter-row" role="group" aria-label="Фильтр по категориям">
            <button type="button" className={`task-filter-chip${activeFilter === 'all' ? ' active' : ''}`} onClick={() => setCategoryFilter('all')}>
              Все <span className="task-filter-count">{displayTasks.length}</span>
            </button>
            {usedCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`task-filter-chip${activeFilter === c.id ? ' active' : ''}`}
                style={activeFilter === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : undefined}
                onClick={() => setCategoryFilter(activeFilter === c.id ? 'all' : c.id)}
              >
                {c.icon} {c.name} <span className="task-filter-count">{categoryCounts.get(c.id)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="task-list">
          {listTasks.map((task) => {
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
                  meta={taskMeta}
                  timer={timer}
                  onOpenTimer={onOpenTimer}
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
                  meta={taskMeta}
                  timer={timer}
                  onOpenTimer={onOpenTimer}
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
                meta={taskMeta}
                timer={timer}
                onOpenTimer={onOpenTimer}
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
        activeTask={activeTask}
        onShowTask={showTaskCard}
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
