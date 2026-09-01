import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TasksPage from './pages/TasksPage';
import CharactersPage from './pages/CharactersPage';

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<TasksPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
