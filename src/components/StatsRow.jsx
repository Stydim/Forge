export default function StatsRow({ streak, streakRecord, onTimeRate, avgSnoozes }) {
  return (
    <div className="stats-row">
      <div className="stat-card streak">
        <div className="stat-label">Серия</div>
        <div className="stat-value">{streak} дней</div>
        <div className="stat-sub">Рекорд {streakRecord}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">В срок</div>
        <div className="stat-value">{onTimeRate}%</div>
        <div className="stat-sub">за 30 дней</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Откладываний</div>
        <div className="stat-value">{avgSnoozes}</div>
        <div className="stat-sub">на задачу</div>
      </div>
    </div>
  );
}
