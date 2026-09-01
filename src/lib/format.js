export function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatOverdue(dueAt) {
  const diffMs = Date.now() - new Date(dueAt).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) {
    return `Просрочено ${minutes} ${pluralRu(minutes, 'минуту', 'минуты', 'минут')}`;
  }
  const hours = Math.round(minutes / 60);
  return `Просрочено ${hours} ${pluralRu(hours, 'час', 'часа', 'часов')}`;
}

export function formatUpcoming(dueAt, recurrenceNote) {
  const date = new Date(dueAt);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const day = isToday ? 'Сегодня' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const base = `${day}, ${time}`;
  return recurrenceNote ? `${base} · ${recurrenceNote}` : base;
}

export function formatDaysLeft(dueAt) {
  const days = Math.max(0, Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000));
  return `${days} ${pluralRu(days, 'день', 'дня', 'дней')} до срока`;
}

export function formatDecimalRu(n) {
  return n.toFixed(1).replace('.', ',');
}

const DAY_PERIODS = [
  { name: 'Ночь', start: 0, end: 6 },
  { name: 'Утро', start: 6, end: 12 },
  { name: 'День', start: 12, end: 18 },
  { name: 'Вечер', start: 18, end: 24 },
];

export function describeSnoozePattern(hourBuckets) {
  const total = hourBuckets.reduce((a, b) => a + b, 0);
  if (!total) return null;

  let best = DAY_PERIODS[0];
  let bestCount = -1;
  for (const period of DAY_PERIODS) {
    const count = hourBuckets.slice(period.start, period.end).reduce((a, b) => a + b, 0);
    if (count > bestCount) {
      bestCount = count;
      best = period;
    }
  }
  if (bestCount === 0) return null;

  return `${best.name} — слабое место: ${bestCount} из ${total} ${pluralRu(total, 'откладывание', 'откладывания', 'откладываний')} до ${best.end}:00.`;
}
