import { useEffect, useMemo, useState } from 'react';
import { Pencil, Scale, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useWeight } from '../hooks/useWeight';
import '../weight.css';

// Weight tracker, ported from Sanct: trend chart, progress ring towards the
// goal, BMI gauge and the history of weighings.

const fmt = (v) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 1 }));
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;
const DAY = 24 * 60 * 60 * 1000;

const RANGES = [
  { value: 'week', label: 'Неделя', days: 7 },
  { value: 'month', label: 'Месяц', days: 31 },
  { value: 'year', label: 'Год', days: 366 },
  { value: 'all', label: 'Всё', days: null },
];

const BMI_ZONES = [
  { label: 'Недостаток', color: '#60A5FA', from: 15, to: 18.5 },
  { label: 'Норма', color: '#3EB489', from: 18.5, to: 25 },
  { label: 'Избыток', color: '#FBBF24', from: 25, to: 30 },
  { label: 'Ожирение', color: '#F87171', from: 30, to: 40 },
];

const toDateInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Share of the way from the first weighing to the goal, 0..100.
function progressPercent(start, current, goal) {
  if (start == null || current == null || !goal || start === goal) return 0;
  const p = (start - current) / (start - goal);
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

function TrendChart({ logs, range }) {
  const points = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days;
    let shown = days ? logs.filter((l) => new Date(l.measured_at) >= Date.now() - days * DAY) : logs;
    if (shown.length < 2) shown = logs.slice(-2); // a line needs two points
    return shown;
  }, [logs, range]);

  if (logs.length === 0) {
    return (
      <div className="weight-chart-empty">
        <Scale size={28} />
        <span>Добавьте первую запись, чтобы увидеть график</span>
      </div>
    );
  }

  const times = points.map((l) => new Date(l.measured_at).getTime());
  const values = points.map((l) => l.value);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const v0 = Math.min(...values) - 1;
  const v1 = Math.max(...values) + 1;
  // Positions in % of the plot box (x by date, so gaps between weighings show).
  const xy = points.map((l, i) => ({
    log: l,
    x: t1 === t0 ? (points.length === 1 ? 50 : (i / (points.length - 1)) * 100) : ((times[i] - t0) / (t1 - t0)) * 100,
    y: 100 - ((l.value - v0) / (v1 - v0)) * 100,
  }));
  const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${xy[xy.length - 1].x},100 L${xy[0].x},100 Z`;
  // At most ~6 date labels, evenly picked.
  const step = Math.max(1, Math.ceil(xy.length / 6));
  const labels = xy.filter((_, i) => i % step === 0 || i === xy.length - 1);

  return (
    <div className="weight-chart">
      <div className="weight-chart-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent-teal)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--accent-teal)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#weight-area)" />
          <path d={line} fill="none" stroke="var(--accent-teal)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {xy.map((p) => (
          <div key={p.log.id} className="weight-chart-point" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span className="weight-chart-tip">
              {fmt(p.log.value)} кг · {new Date(p.log.measured_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>
      <div className="weight-chart-labels">
        {labels.map((p) => (
          <span key={p.log.id} style={{ left: `${p.x}%` }}>
            {new Date(p.log.measured_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}

// 270° ring from the first weighing to the goal, with quarter milestones.
function ProgressRing({ start, current, goal, percent, minWeek }) {
  const R = 106;
  const C = 2 * Math.PI * R;
  const track = 0.75 * C;
  const ticks = goal && start != null ? [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, val: start + (goal - start) * f })) : [];
  const losing = start != null && goal != null && start > goal;
  const reached = (val) => (losing ? current <= val : current >= val);
  const pos = (f) => {
    const a = ((-135 + f * 270) * Math.PI) / 180;
    return { left: 120 + R * Math.sin(a), top: 120 - R * Math.cos(a) };
  };

  return (
    <div className="weight-ring">
      <svg width="240" height="240" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r={R} fill="none" stroke="var(--bg-chip)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${track} ${C}`} transform="rotate(135 120 120)" />
        <circle cx="120" cy="120" r={R} fill="none" stroke="var(--accent-teal)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(percent / 100) * track} ${C}`} transform="rotate(135 120 120)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      {ticks.map((t) => (
        <span key={t.f} className={`weight-ring-tick${current != null && reached(t.val) ? ' reached' : ''}`} style={pos(t.f)} title={`${fmt(t.val)} кг`} />
      ))}
      {current != null && goal && <span className="weight-ring-current" style={pos(percent / 100)} />}
      <div className="weight-ring-center">
        <div className="weight-ring-label">Прогресс {percent}%</div>
        <div className="weight-ring-value">{fmt(current)}</div>
        <div className="weight-ring-sub">
          {minWeek ? <>Минимум за 7 дней: {fmt(minWeek.value)}<br />{minWeek.daysAgo ? `${minWeek.daysAgo} дн. назад` : 'сегодня'}</> : 'За 7 дней записей нет'}
        </div>
      </div>
    </div>
  );
}

function BmiGauge({ bmi }) {
  // Four equal visual quarters, value mapped within its zone.
  let percent = 0;
  if (bmi) {
    const i = Math.max(0, BMI_ZONES.findIndex((z) => bmi <= z.to));
    const zone = BMI_ZONES[bmi > 30 ? 3 : i];
    const within = (Math.min(Math.max(bmi, zone.from), zone.to) - zone.from) / (zone.to - zone.from);
    percent = (BMI_ZONES.indexOf(zone) + within) * 25;
  }
  const arc = (from, to) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    const p = (a) => `${100 + 80 * Math.cos(a)},${100 - 80 * Math.sin(a)}`;
    return `M${p(a0)} A80,80 0 0 1 ${p(a1)}`;
  };
  const needle = Math.PI * (1 - percent / 100);
  const zone = bmi ? BMI_ZONES.find((z) => bmi <= z.to) || BMI_ZONES[3] : null;

  return (
    <div className="weight-bmi">
      <svg viewBox="0 0 200 110" className="weight-bmi-gauge">
        {BMI_ZONES.map((z, i) => (
          <path key={z.label} d={arc(i * 25 + 1.2, (i + 1) * 25 - 1.2)} fill="none" stroke={z.color} strokeWidth="16" strokeLinecap="round" />
        ))}
        {bmi > 0 && <circle cx={100 + 80 * Math.cos(needle)} cy={100 - 80 * Math.sin(needle)} r="9" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="4" />}
        <text x="100" y="96" textAnchor="middle" className="weight-bmi-value">{bmi ? fmt(bmi) : '—'}</text>
      </svg>
      <div className="weight-bmi-zone" style={zone ? { color: zone.color } : undefined}>{zone ? zone.label : 'Нет данных'}</div>
      <div className="weight-bmi-legend">
        {BMI_ZONES.map((z) => <span key={z.label}><i style={{ background: z.color }} />{z.label}</span>)}
      </div>
    </div>
  );
}

function LogModal({ log, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(log ? toDateInput(log.measured_at) : toDateInput(new Date()));
  const [value, setValue] = useState(log ? String(log.value) : '');
  const [note, setNote] = useState(log?.note || '');
  const num = parseFloat(value.replace(',', '.'));
  const valid = num > 0 && num < 500 && date;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    // Keep the original time when the day didn't change; otherwise the
    // current time on the chosen day (as Sanct did).
    let measuredAt;
    if (log && toDateInput(log.measured_at) === date) measuredAt = log.measured_at;
    else {
      const [y, m, d] = date.split('-').map(Number);
      const now = new Date();
      measuredAt = new Date(y, m - 1, d, now.getHours(), now.getMinutes()).toISOString();
    }
    onSave({ measured_at: measuredAt, value: Math.round(num * 10) / 10, note: note.trim() });
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <form className="task-modal weight-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <h2 className="task-modal-title">{log ? 'Изменить запись' : 'Новая запись веса'}</h2>

        <label className="task-modal-label" htmlFor="weight-value">Вес, кг</label>
        <input id="weight-value" className="task-modal-input" type="number" step="0.1" inputMode="decimal" placeholder="Например, 72,5" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />

        <label className="task-modal-label" htmlFor="weight-date">Дата взвешивания</label>
        <input id="weight-date" className="task-modal-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label className="task-modal-label" htmlFor="weight-note">Заметка (по желанию)</label>
        <input id="weight-note" className="task-modal-input" placeholder="Утром, после тренировки…" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="task-modal-actions">
          <div className="task-modal-actions-left">
            {log && <button type="button" className="task-modal-btn-small" onClick={() => onDelete(log.id)}><Trash2 size={14} /> Удалить</button>}
          </div>
          <div className="task-modal-actions-right">
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save" disabled={!valid}>Сохранить</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function GoalModal({ goal, onClose, onSave }) {
  const [value, setValue] = useState(goal ? String(goal) : '');
  const num = parseFloat(value.replace(',', '.'));
  const valid = num > 0 && num < 500;
  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <form className="task-modal weight-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (valid) onSave(Math.round(num * 10) / 10); }}>
        <button type="button" className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <h2 className="task-modal-title">Целевой вес</h2>
        <label className="task-modal-label" htmlFor="weight-goal">Цель, кг</label>
        <input id="weight-goal" className="task-modal-input" type="number" step="0.1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <div className="task-modal-actions">
          <div className="task-modal-actions-right">
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save" disabled={!valid}>Сохранить</button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function WeightPage() {
  const { logs, settings, loading, error, addLog, updateLog, deleteLog, saveSettings } = useWeight();
  const [range, setRange] = useState('month');
  const [editing, setEditing] = useState(null); // null | 'new' | log
  const [goalOpen, setGoalOpen] = useState(false);
  const [height, setHeight] = useState('');
  useEffect(() => { setHeight(settings.height_cm ? String(settings.height_cm) : ''); }, [settings.height_cm]);

  const goal = settings.goal_kg;
  const first = logs[0] ?? null;
  const last = logs[logs.length - 1] ?? null;
  const start = first?.value ?? null;
  const current = last?.value ?? null;
  const change = first && last ? last.value - first.value : 0;
  const percent = progressPercent(start, current, goal);
  const losing = goal != null && start != null ? start > goal : true;

  const heightNum = parseFloat(String(height).replace(',', '.'));
  const bmi = current && heightNum > 50 && heightNum < 300 ? current / (heightNum / 100) ** 2 : null;

  const minWeek = useMemo(() => {
    const recent = logs.filter((l) => new Date(l.measured_at) >= Date.now() - 7 * DAY);
    if (!recent.length) return null;
    const min = recent.reduce((a, b) => (b.value < a.value ? b : a));
    return { value: min.value, daysAgo: Math.floor((Date.now() - new Date(min.measured_at)) / DAY) };
  }, [logs]);

  // Next quarter milestone on the way to the goal.
  const next = useMemo(() => {
    if (goal == null || start == null || current == null) return null;
    const steps = [0.25, 0.5, 0.75, 1].map((f) => start + (goal - start) * f);
    return steps.find((t) => (losing ? t < current : t > current)) ?? goal;
  }, [goal, start, current, losing]);

  const saveHeight = () => {
    const v = heightNum > 50 && heightNum < 300 ? Math.round(heightNum) : null;
    if (v !== (settings.height_cm ?? null)) saveSettings({ height_cm: v });
  };

  const history = [...logs].reverse();
  const dateLong = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="goals-page weight-page">
      <div className="goals-page-header">
        <div>
          <div className="page-date">ТРЕКЕР ВЕСА</div>
          <h1 className="page-heading">{current != null ? `${fmt(current)} кг` : 'Первое взвешивание'}</h1>
        </div>
        <button className="goals-new-btn" onClick={() => setEditing('new')}>+ Запись</button>
      </div>

      {error && (
        <div className="task-card urgent" style={{ marginBottom: 16 }}>
          <div className="task-card-meta">Не удалось связаться с базой: {error}</div>
        </div>
      )}

      <div className="weight-grid">
        <section className="weight-card">
          <div className="weight-card-head">
            <span className="weight-card-title">Тренд веса</span>
            <div className="weight-range" role="group" aria-label="Период">
              {RANGES.map((r) => (
                <button key={r.value} type="button" className={range === r.value ? 'active' : ''} onClick={() => setRange(r.value)}>{r.label}</button>
              ))}
            </div>
          </div>
          {!loading && <TrendChart logs={logs} range={range} />}
        </section>

        <section className="weight-card weight-progress">
          <div className="weight-card-head"><span className="weight-card-title">Путь к цели</span></div>
          <div className="weight-progress-body">
            <div className="weight-side">
              <div><div className="weight-side-label">Старт 🚀</div><div className="weight-side-value">{fmt(start)} кг</div>{first && <div className="weight-side-sub">{dateLong(first.measured_at)}</div>}</div>
              <div><div className="weight-side-label">ИМТ</div><div className="weight-side-value">{bmi ? fmt(bmi) : '—'}</div></div>
            </div>
            <ProgressRing start={start} current={current} goal={goal} percent={percent} minWeek={minWeek} />
            <div className="weight-side right">
              <div><div className="weight-side-label">Следующий 🏁</div><div className="weight-side-value">{next != null ? `${fmt(next)} кг` : '—'}</div></div>
              <div><div className="weight-side-label">Цель 🏆</div><div className="weight-side-value">{goal ? `${fmt(goal)} кг` : '—'}</div></div>
            </div>
          </div>
        </section>
      </div>

      <div className="stats-row weight-stats">
        <div className="stat-card streak">
          <div className="stat-label">Текущий вес</div>
          <div className="stat-value">{fmt(current)} <small>кг</small></div>
          <div className="stat-sub">{last ? dateLong(last.measured_at) : 'нет записей'}</div>
        </div>
        <button type="button" className="stat-card weight-goal-card" onClick={() => setGoalOpen(true)} title="Изменить цель">
          <div className="stat-label">Цель <Target size={13} /></div>
          <div className="stat-value">{goal ? fmt(goal) : '—'} <small>кг</small></div>
          <div className="stat-sub">{goal && current != null ? `осталось ${fmt(Math.abs(current - goal))} кг` : 'нажмите, чтобы задать'}</div>
        </button>
        <div className="stat-card">
          <div className="stat-label">Изменение {change <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}</div>
          <div className="stat-value">{signed(change)} <small>кг</small></div>
          <div className="stat-sub">с первой записи</div>
        </div>
      </div>

      <h2 className="weight-section-title">История записей</h2>
      {!loading && history.length === 0 && <div className="archive-empty">Пока нет ни одной записи — добавь первую.</div>}
      <div className="weight-history">
        {history.map((log, i) => {
          const prev = history[i + 1];
          const diff = prev ? log.value - prev.value : null;
          const good = diff != null && diff !== 0 && (losing ? diff < 0 : diff > 0);
          return (
            <div key={log.id} className="weight-row">
              <div className="weight-row-icon"><Scale size={18} /></div>
              <div className="weight-row-main">
                <div className="weight-row-date">{dateLong(log.measured_at)}</div>
                <div className="weight-row-note">
                  {log.note || 'Обычное взвешивание'} · {new Date(log.measured_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="weight-row-values">
                <div className="weight-row-value">{fmt(log.value)} кг</div>
                <div className={`weight-row-diff${diff ? (good ? ' good' : ' bad') : ''}`}>{diff == null ? 'первая' : `${signed(diff)} кг`}</div>
              </div>
              <button type="button" className="task-card-icon-btn" onClick={() => setEditing(log)} aria-label="Изменить запись"><Pencil size={15} /></button>
            </div>
          );
        })}
      </div>

      <h2 className="weight-section-title">ИМТ (индекс массы тела)</h2>
      <div className="weight-grid">
        <section className="weight-card"><BmiGauge bmi={bmi} /></section>
        <section className="weight-card weight-height">
          <div className="weight-card-title">Ваш рост</div>
          <div className="weight-height-input">
            <input className="task-modal-input" type="number" inputMode="numeric" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} onBlur={saveHeight} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <span>см</span>
          </div>
          <p className="weight-height-hint">Используется для расчёта ИМТ. ИМТ — ориентировочный показатель: он не учитывает соотношение мышц и жира.</p>
        </section>
      </div>

      {editing && (
        <LogModal
          log={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(fields) => { if (editing === 'new') addLog(fields); else updateLog(editing.id, fields); setEditing(null); }}
          onDelete={(id) => { if (confirm('Удалить эту запись?')) { deleteLog(id); setEditing(null); } }}
        />
      )}
      {goalOpen && <GoalModal goal={goal} onClose={() => setGoalOpen(false)} onSave={(v) => { saveSettings({ goal_kg: v }); setGoalOpen(false); }} />}
    </div>
  );
}
