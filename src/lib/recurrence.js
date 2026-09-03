import { pluralRu } from './format';

const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export const DAY_LABELS = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' };

const REPEAT_LABELS = {
  daily: 'ежедневно',
  weekly: 'еженедельно',
  weekdays: 'по будням',
  weekends: 'по выходным',
  monthly: 'ежемесячно',
  yearly: 'ежегодно',
};

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + n;
  d.setMonth(targetMonth);
  // Handle overflow, e.g. Jan 31 + 1 month should land on Feb 28/29, not Mar 3.
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0);
  }
  return d;
}

function nextWeekday(date) {
  let d = addDays(date, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}

function nextWeekend(date) {
  let d = addDays(date, 1);
  while (d.getDay() !== 0 && d.getDay() !== 6) d = addDays(d, 1);
  return d;
}

function nextCustomDay(date, days) {
  if (!days || days.length === 0) return null;
  const targets = new Set(days.map((d) => DAY_INDEX[d]));
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(date, i);
    if (targets.has(candidate.getDay())) return candidate;
  }
  return null;
}

/** Given the current due date and a repeat rule, returns the next Date (or null if the task doesn't repeat). */
export function getNextOccurrence(currentDueAt, repeatType, repeatDays) {
  const base = currentDueAt ? new Date(currentDueAt) : new Date();
  switch (repeatType) {
    case 'daily': return addDays(base, 1);
    case 'weekly': return addDays(base, 7);
    case 'weekdays': return nextWeekday(base);
    case 'weekends': return nextWeekend(base);
    case 'monthly': return addMonths(base, 1);
    case 'yearly': return addMonths(base, 12);
    case 'custom_days': return nextCustomDay(base, repeatDays);
    default: return null;
  }
}

/**
 * Builds the display text for a task's recurrence: the pattern (or specific
 * days), how many times a day, and — if the series has a limit — how it ends.
 * Used both when a task is first created and when the engine spawns the next
 * occurrence (so "осталось N раз" stays accurate as the count ticks down).
 */
export function buildRecurrenceNote(repeatType, repeatDays, timesPerDay, endType, occurrencesLeft, endDateIso) {
  let base = null;
  if (repeatType === 'custom_days') {
    if (repeatDays && repeatDays.length > 0) {
      base = `по ${repeatDays.map((d) => DAY_LABELS[d]).join(', ')}`;
    }
  } else if (repeatType && repeatType !== 'none') {
    base = REPEAT_LABELS[repeatType] ?? null;
  }

  if (timesPerDay > 1) {
    const timesText = `${timesPerDay} ${pluralRu(timesPerDay, 'раз', 'раза', 'раз')} в день`;
    base = base ? `${base} · ${timesText}` : timesText;
  }

  if (repeatType && repeatType !== 'none') {
    let endSuffix = null;
    if (endType === 'count' && occurrencesLeft != null) {
      endSuffix = `осталось ${occurrencesLeft} ${pluralRu(occurrencesLeft, 'раз', 'раза', 'раз')}`;
    } else if (endType === 'date' && endDateIso) {
      endSuffix = `до ${new Date(endDateIso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
    }
    if (endSuffix) base = base ? `${base} · ${endSuffix}` : endSuffix;
  }

  return base;
}
