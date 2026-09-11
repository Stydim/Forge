import { useState } from 'react';
import HabitCard from '../components/HabitCard';
import HabitFormModal from '../components/HabitFormModal';

export default function HabitsPage({ habits: habitsState }) {
  const { habits, loading, error, addHabit, updateHabit, deleteHabit, toggleHabitDay } = habitsState;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

  const openNewHabitModal = () => {
    setEditingHabit(null);
    setModalOpen(true);
  };

  const openEditHabitModal = (habit) => {
    setEditingHabit(habit);
    setModalOpen(true);
  };

  return (
    <div className="goals-page">
      <div className="goals-page-header">
        <div>
          <div className="page-date">ПРИВЫЧКИ</div>
          <h1 className="page-heading">Каждый день понемногу</h1>
        </div>
        <button className="goals-new-btn" onClick={openNewHabitModal}>+ Новая привычка</button>
      </div>

      {error && (
        <div className="task-card urgent" style={{ marginBottom: 16 }}>
          <div className="task-card-meta">Не удалось связаться с базой: {error}</div>
        </div>
      )}

      {!loading && habits.length === 0 && (
        <div className="archive-empty">Пока нет ни одной привычки — добавь первую.</div>
      )}

      <div className="task-list">
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            onToggle={toggleHabitDay}
            onEdit={openEditHabitModal}
          />
        ))}
      </div>

      <HabitFormModal
        open={modalOpen}
        editingHabit={editingHabit}
        onClose={() => setModalOpen(false)}
        onCreate={addHabit}
        onUpdate={updateHabit}
        onDelete={deleteHabit}
      />
    </div>
  );
}
