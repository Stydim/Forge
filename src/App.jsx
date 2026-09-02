import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TasksPage from './pages/TasksPage';
import CharactersPage from './pages/CharactersPage';
import TaskFormModal from './components/TaskFormModal';
import { useTasks } from './hooks/useTasks';

export default function App() {
  const tasks = useTasks();
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar onNewTask={() => setIsNewTaskOpen(true)} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<TasksPage tasks={tasks} />} />
          <Route path="/tasks" element={<TasksPage tasks={tasks} />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TaskFormModal
        open={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSubmit={tasks.addTask}
      />
    </div>
  );
}
