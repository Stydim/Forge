import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TasksPage from './pages/TasksPage';
import CharactersPage from './pages/CharactersPage';
import ArchivePage from './pages/ArchivePage';
import TaskFormModal from './components/TaskFormModal';
import { useTasks } from './hooks/useTasks';

export default function App() {
  const tasks = useTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

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
    <div className="app-layout">
      <Sidebar onNewTask={openNewTaskModal} taskCount={taskCount} goalCount={goalCount} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<TasksPage tasks={tasks} onEditTask={openEditTaskModal} />} />
          <Route path="/tasks" element={<TasksPage tasks={tasks} onEditTask={openEditTaskModal} />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/archive" element={<ArchivePage onRestore={tasks.load} />} />
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
