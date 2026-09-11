import { localDateKey } from './streaks';

const DAY_TOKENS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function isHabitDueOn(targetDays, date) {
  if (!targetDays || targetDays.length === 0) return true;
  return targetDays.includes(DAY_TOKENS[date.getDay()]);
}

// 0..1 fraction of a day's times-per-day target reached — drives the
// pie/bar fill so "1 of 2" visibly reads as half-done, not just "not done".
export function habitProgress(count, timesPerDay) {
  return Math.max(0, Math.min(1, count / Math.max(1, timesPerDay)));
}

// A conic-gradient "pie" fill for round/square indicators — grows clockwise
// from empty (bg-chip) to a full ring of the habit's color.
export function habitPieFill(progress, color) {
  if (progress <= 0) return undefined;
  if (progress >= 1) return { background: color };
  return { background: `conic-gradient(${color} ${progress * 360}deg, var(--bg-chip) 0deg)` };
}

// A left-to-right linear fill for thin bars (the history strip).
export function habitBarFill(progress, color) {
  if (progress <= 0) return undefined;
  if (progress >= 1) return { background: color };
  return { background: `linear-gradient(to right, ${color} ${progress * 100}%, var(--bg-chip) 0)` };
}

// Walks backward from today counting consecutive DUE days that were fully
// completed. A due-but-not-yet-done today doesn't break the streak (the day
// isn't over) — it just isn't counted until it's actually done, mirroring
// computeStreaks' same "give today a pass" rule for the task-completion streak.
export function calcHabitStreak(habit) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (!isHabitDueOn(habit.target_days, d)) continue;
    const key = localDateKey(d.toISOString());
    const done = (habit.completions[key] || 0) >= habit.times_per_day;
    if (done) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}
