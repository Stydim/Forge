function pad(n) {
  return String(n).padStart(2, '0');
}

// Local (not UTC) YYYY-MM-DD for a Date — the format the date <input> and
// resolveDueAtWithoutTime both use.
export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Resolves a date-only ("YYYY-MM-DD") due date to a full timestamp when no
// specific time was given. Today defaults to right now, so a same-day task
// isn't born already overdue; any future date defaults to 09:00 — a
// reasonable "start of day" without implying the task is late the instant
// it exists.
export function resolveDueAtWithoutTime(dateOnlyStr) {
  const now = new Date();
  if (dateOnlyStr === dateKey(now)) return now;
  return new Date(`${dateOnlyStr}T09:00`);
}
