import { useMemo, useState } from 'react';
import { ProgressTaskCard } from '../components/TaskCard';
import GoalFormModal from '../components/GoalFormModal';
import { formatDaysLeft } from '../lib/format';

function annotateSubtasks(subtasks) {
  const firstPendingIndex = subtasks.findIndex((s) => !s.done);
  return subtasks.map((s, i) => ({ ...s, active: i === firstPendingIndex }));
}

function deriveGoal(task) {
  const subtasks = annotateSubtasks(task.subtasks);
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.done).length;
  const meta = task.due_at
    ? `${formatDaysLeft(task.due_at)} · ${done} из ${total} шагов`
    : `${done} из ${total} шагов`;
  return { ...task, subtasks, progress: total ? Math.round((done / total) * 100) : 0, meta };
}

export default function GoalsPage({ tasks: tasksState }) {
  const { tasks, loading, error, toggleSubtask, addGoal, updateGoal } = tasksState;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const goals = useMemo(
    () => tasks.filter((t) => t.kind === 'goal').map(deriveGoal),
    [tasks],
  );

  const openNewGoalModal = () => {
    setEditingGoal(null);
    setModalOpen(true);
  };

  const openEditGoalModal = (goal) => {
    setEditingGoal(goal);
    setModalOpen(true);
  };

  return (
    <div className="goals-page">
      <div className="goals-page-header">
        <div>
          <div className="page-date">ЦЕЛИ</div>
          <h1 className="page-heading">Куда двигаешься</h1>
        </div>
        <button className="goals-new-btn" onClick={openNewGoalModal}>+ Новая цель</button>
      </div>

      {error && (
        <div className="task-card urgent" style={{ marginBottom: 16 }}>
          <div className="task-card-meta">Не удалось связаться с базой: {error}</div>
        </div>
      )}

      {!loading && goals.length === 0 && (
        <div className="archive-empty">Пока нет ни одной цели — добавь первую.</div>
      )}

      <div className="task-list">
        {goals.map((goal) => (
          <ProgressTaskCard
            key={goal.id}
            task={goal}
            onSubtaskClick={toggleSubtask}
            onEdit={openEditGoalModal}
          />
        ))}
      </div>

      <GoalFormModal
        open={modalOpen}
        editingGoal={editingGoal}
        onClose={() => setModalOpen(false)}
        onCreate={addGoal}
        onUpdate={updateGoal}
      />
    </div>
  );
}
