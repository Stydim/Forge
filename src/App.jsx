import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TasksPage from './pages/TasksPage';
import GoalsPage from './pages/GoalsPage';
import ProgressPage from './pages/ProgressPage';
import CharactersPage from './pages/CharactersPage';
import ArchivePage from './pages/ArchivePage';
import SettingsPage from './pages/SettingsPage';
import TaskFormModal from './components/TaskFormModal';
import { useTasks } from './hooks/useTasks';
import { useActiveCharacter } from './hooks/useActiveCharacter';
import { useBackground } from './hooks/useBackground';
import { getBackground } from './lib/backgrounds';

const SELECTED_TASK_KEY = 'forge:selected-task-id';

export default function App() {
  const tasks = useTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeCharacterId, setActiveCharacterId] = useActiveCharacter();
  const [backgroundId, setBackgroundId] = useBackground();
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
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const taskCount = tasks.tasks.filter((t) => t.kind === 'task').length;
  const goalCount = tasks.tasks.filter((t) => t.kind === 'goal').length;

  return (
    <div
      className={`app-layout${background?.dark ? ' bg-dark' : ''}`}
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
      <Sidebar
        onNewTask={openNewTaskModal}
        taskCount={taskCount}
        goalCount={goalCount}
        activeCharacterId={activeCharacterId}
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
              />
            }
          />
          <Route path="/goals" element={<GoalsPage tasks={tasks} />} />
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
      />
    </div>
  );
}
