import { useProgress } from '../hooks/useProgress';
import { formatDecimalRu, pluralRu, describeSnoozePattern } from '../lib/format';

export default function ProgressPage() {
  const { stats, loading } = useProgress();

  const val = (v, suffix = '') => (loading || !stats || v == null ? '—' : `${v}${suffix}`);

  const dailyMax = stats ? Math.max(1, ...stats.dailyCounts) : 1;
  const dailyTotal = stats ? stats.dailyCounts.reduce((a, b) => a + b, 0) : 0;
  const dailyAvg = stats && dailyTotal ? formatDecimalRu(dailyTotal / stats.dailyCounts.length) : null;

  const hourCaption = stats ? describeSnoozePattern(stats.hourBuckets) : null;
  const hourMax = stats ? Math.max(1, ...stats.hourBuckets) : 1;

  return (
    <div className="progress-page">
      <div className="page-date">ПРОГРЕСС</div>
      <h1 className="page-heading">Как оно на самом деле</h1>

      <div className="progress-stats-grid">
        <div className="stat-card streak">
          <div className="stat-label">Серия</div>
          <div className="stat-value">{val(stats?.streak, ' дн.')}</div>
          <div className="stat-sub">сейчас</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Рекорд</div>
          <div className="stat-value">{val(stats?.streakRecord, ' дн.')}</div>
          <div className="stat-sub">лучшая серия</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Выполнено</div>
          <div className="stat-value">{val(stats?.totalCompleted)}</div>
          <div className="stat-sub">за всё время</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">В срок</div>
          <div className="stat-value">{val(stats?.onTimeRate90, '%')}</div>
          <div className="stat-sub">за 90 дней</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Откладываний</div>
          <div className="stat-value">{loading || !stats || stats.avgSnoozes90 == null ? '—' : formatDecimalRu(stats.avgSnoozes90)}</div>
          <div className="stat-sub">на задачу, 90 дней</div>
        </div>
      </div>

      <div className="progress-panel">
        <div className="progress-panel-title">Выполнено по дням — последние 30 дней</div>
        <div className="progress-chart">
          {(stats?.dailyCounts ?? new Array(30).fill(0)).map((v, i) => (
            <div
              key={i}
              className={`progress-bar${v >= dailyMax && v > 0 ? ' high' : ''}`}
              style={{ height: `${Math.max(4, (v / dailyMax) * 100)}%` }}
              title={`${v} ${pluralRu(v, 'задача', 'задачи', 'задач')}`}
            />
          ))}
        </div>
        <div className="progress-chart-caption">
          {dailyTotal
            ? `${dailyTotal} ${pluralRu(dailyTotal, 'задача', 'задачи', 'задач')} за 30 дней · в среднем ${dailyAvg} в день.`
            : 'Пока нет выполненных задач за этот период.'}
        </div>
      </div>

      <div className="progress-panel">
        <div className="progress-panel-title">Откладывания по часам — последние 90 дней</div>
        <div className="progress-chart">
          {(stats?.hourBuckets ?? new Array(24).fill(0)).map((v, i) => (
            <div
              key={i}
              className={`progress-bar${v >= hourMax && v > 0 ? ' high' : ''}`}
              style={{ height: `${Math.max(4, (v / hourMax) * 100)}%` }}
              title={`${i}:00 — ${v} ${pluralRu(v, 'раз', 'раза', 'раз')}`}
            />
          ))}
        </div>
        <div className="progress-chart-caption">
          {hourCaption ?? 'Пока нет данных об откладываниях за этот период.'}
        </div>
      </div>
    </div>
  );
}
