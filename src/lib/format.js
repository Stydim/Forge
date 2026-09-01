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
