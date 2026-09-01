import { formatDecimalRu, pluralRu } from '../lib/format';

export default function StatsRow({ stats, loading }) {
  const streak = loading || !stats ? '—' : `${stats.streak} ${pluralRu(stats.streak, 'день', 'дня', 'дней')}`;
  const streakRecord = loading || !stats ? '—' : stats.streakRecord;
  const onTime = loading || !stats || stats.onTimeRate == null ? '—' : `${stats.onTimeRate}%`;
  const avgSnoozes = loading || !stats || stats.avgSnoozes == null ? '—' : formatDecimalRu(stats.avgSnoozes);

  return (
    <div className="stats-row">
      <div className="stat-card streak">
        <div className="stat-label">Серия</div>
        <div className="stat-value">{streak}</div>
        <div className="stat-sub">Рекорд {streakRecord}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">В срок</div>
        <div className="stat-value">{onTime}</div>
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
