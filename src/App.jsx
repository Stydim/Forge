import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TasksPage from './pages/TasksPage';
import GoalsPage from './pages/GoalsPage';
import HabitsPage from './pages/HabitsPage';
import WeightPage from './pages/WeightPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import ProgressPage from './pages/ProgressPage';
import CharactersPage from './pages/CharactersPage';
import ArchivePage from './pages/ArchivePage';
import SettingsPage from './pages/SettingsPage';
import ReaderLibraryPage from './pages/ReaderLibraryPage';
import ReaderPage from './pages/ReaderPage';
import ReaderPastePage from './pages/ReaderPastePage';
import FlashcardsPage from './pages/FlashcardsPage';
import TaskFormModal from './components/TaskFormModal';
import { useTasks } from './hooks/useTasks';
import { useHabits } from './hooks/useHabits';
import { useSubscriptions } from './hooks/useSubscriptions';
import { useBooks } from './hooks/useBooks';
import { useSavedWords } from './hooks/useSavedWords';
import { useQuotes } from './hooks/useQuotes';
import { useTaskMeta } from './hooks/useTaskMeta';
import { useTaskTimer } from './hooks/useTaskTimer';
import { FloatingTimer, TaskTimerModal } from './components/TaskTimer';
import { useActiveCharacter } from './hooks/useActiveCharacter';
import { useBackground } from './hooks/useBackground';
import { getBackground } from './lib/backgrounds';

const SELECTED_TASK_KEY = 'forge:selected-task-id';

export default function App() {
  const tasks = useTasks();
  const habits = useHabits();
  // Lives here (not in the page) so "Оплата: …" reminder tasks get created
  // whichever page is open.
  const subscriptions = useSubscriptions({ addTask: tasks.addTask });
  const books = useBooks();
  const savedWords = useSavedWords();
  const quotes = useQuotes();
  // Task categories & tags; their renames/deletions are mirrored onto loaded tasks.
  const taskMeta = useTaskMeta({
    onTagRenamed: tasks.renameTagLocally,
    onTagDeleted: tasks.removeTagLocally,
    onCategoryDeleted: tasks.clearCategoryLocally,
  });
  // One task time tracker for the whole app (floating pill on every page).
  const taskTimer = useTaskTimer(tasks.logTime);
  const [timerTaskId, setTimerTaskId] = useState(null);
  const timerTask = tasks.tasks.find((t) => t.id === timerTaskId);
  const runningTask = taskTimer.timer
    ? tasks.tasks.find((t) => t.id === taskTimer.timer.taskId) || { id: taskTimer.timer.taskId, title: 'Задача' }
    : null;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeCharacterId, setActiveCharacterId] = useActiveCharacter();
  const [backgroundId, setBackgroundId] = useBackground();
  // The sidebar (nav + character card) becomes a slide-in drawer below the
  // 768px breakpoint — it was previously just `display:none` there with no
  // replacement, so mobile had no way to navigate at all.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const background = getBackground(backgroundId);
  // Lives here (not inside TasksPage) so it survives TasksPage remounting —
  // e.g. the sidebar's Цели/Прогресс links currently redirect back to
  // Tasks since those pages don't exist yet. Persisted to localStorage too,
  // so a full page reload (F5) keeps showing the same task's dialogue
  // instead of falling back to auto-focus and losing the pinned choice.
  const [selectedTaskId, setSelectedTaskIdState] = useState(() => {
    try { return localStorage.getItem(SELECTED_TASK_KEY) || null; } catch { return null; }
  });
  const setSelectedTaskId = (id) => {
    setSelectedTaskIdState(id);
    try {
      if (id) localStorage.setItem(SELECTED_TASK_KEY, id);
      else localStorage.removeItem(SELECTED_TASK_KEY);
    } catch {
      // localStorage unavailable — selection just won't survive a reload.
    }
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setModalOpen(true);
    setMobileNavOpen(false);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const taskCount = tasks.tasks.filter((t) => t.kind === 'task').length;
  const goalCount = tasks.tasks.filter((t) => t.kind === 'goal').length;

  return (
    <div
      className={`app-layout${background ? ` has-bg bg-${background.id}` : ''}${background?.dark ? ' bg-dark' : ''}`}
      style={background ? {
        // Lives on the outer layout (not just app-content) so the same photo
        // shows through the sidebar too — both panels render it transparent
        // and this is what's actually behind them. A light cream scrim keeps
        // heading text (dark, sized for the plain cream page) readable no
        // matter how dark the chosen photo is.
        backgroundImage: `linear-gradient(rgba(251, 247, 238, 0.32), rgba(251, 247, 238, 0.32)), url(${background.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : undefined}
    >
      <div className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Открыть меню">
          <Menu size={22} />
        </button>
        <img className="mobile-topbar-logo" src="/logo.png" alt="" />
        <span className="mobile-topbar-title">Forge</span>
      </div>
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <Sidebar
        onNewTask={openNewTaskModal}
        taskCount={taskCount}
        goalCount={goalCount}
        activeCharacterId={activeCharacterId}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <main className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <TasksPage
                tasks={tasks}
                onEditTask={openEditTaskModal}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                activeCharacterId={activeCharacterId}
                taskMeta={taskMeta}
                timer={taskTimer.timer}
                onOpenTimer={setTimerTaskId}
              />
            }
          />
          <Route
            path="/tasks"
            element={
              <TasksPage
                tasks={tasks}
                onEditTask={openEditTaskModal}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                activeCharacterId={activeCharacterId}
                taskMeta={taskMeta}
                timer={taskTimer.timer}
                onOpenTimer={setTimerTaskId}
              />
            }
          />
          <Route path="/goals" element={<GoalsPage tasks={tasks} />} />
          <Route path="/habits" element={<HabitsPage habits={habits} />} />
          <Route path="/weight" element={<WeightPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage subscriptions={subscriptions} />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route
            path="/characters"
            element={
              <CharactersPage
                activeCharacterId={activeCharacterId}
                onSelectCharacter={setActiveCharacterId}
              />
            }
          />
          <Route path="/archive" element={<ArchivePage onRestore={tasks.load} />} />
          <Route
            path="/reader"
            element={(
              <ReaderLibraryPage
                books={books.books}
                loading={books.loading}
                error={books.error}
                onUpload={books.upload}
                onDelete={books.removeBook}
                onPlace={books.place}
                onUpdate={books.updateFields}
                quotes={quotes}
              />
            )}
          />
          <Route path="/reader/book/:bookId" element={<ReaderPage onProgress={books.setProgress} savedWords={savedWords} onSaveQuote={quotes.add} />} />
          <Route path="/reader/new" element={<ReaderPastePage books={books.books} onCreate={books.createFromText} onAppend={books.appendText} onRename={books.rename} onPlace={books.place} onUpdate={books.updateFields} />} />
          <Route path="/reader/paste/:bookId" element={<ReaderPastePage books={books.books} onCreate={books.createFromText} onAppend={books.appendText} onRename={books.rename} onPlace={books.place} onUpdate={books.updateFields} />} />
          <Route path="/reader/cards" element={<FlashcardsPage savedWords={savedWords} />} />
          <Route
            path="/settings"
            element={<SettingsPage backgroundId={backgroundId} onSelectBackground={setBackgroundId} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TaskFormModal
        open={modalOpen}
        editingTask={editingTask}
        onClose={() => setModalOpen(false)}
        onCreate={tasks.addTask}
        onUpdate={tasks.updateTask}
        onDelete={tasks.deleteTask}
        meta={taskMeta}
      />
      {timerTask && (
        <TaskTimerModal
          task={timerTask}
          timerApi={taskTimer}
          onClose={() => setTimerTaskId(null)}
          onSetTarget={(id, minutes) => tasks.patchTask(id, { time_target_minutes: minutes })}
        />
      )}
      <FloatingTimer task={runningTask} timerApi={taskTimer} onOpen={() => runningTask && setTimerTaskId(runningTask.id)} />
    </div>
  );
}
