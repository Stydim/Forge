// Thin fetch client for the app's own REST API (server.js): both the Grok
// proxy endpoints and the forge-schema data endpoints on Render Postgres
// that replaced direct supabase-js table access — see server.js for routes.
const BASE = '/api';

export async function parseTaskText(text) {
  try {
    const res = await fetch('/api/parse-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGnomeLines(payload) {
  try {
    const res = await fetch('/api/gnome-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.lines) && data.lines.length ? data.lines : null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const json = (body) => JSON.stringify(body);

// Tasks
export const listOpenTasks = () => request('/tasks');
export const listArchivedTasks = () => request('/tasks/archive');
export const listCompletedTaskStats = () => request('/tasks/completed-stats');
export const createTask = (fields) => request('/tasks', { method: 'POST', body: json(fields) });
export const updateTask = (id, fields) => request(`/tasks/${id}`, { method: 'PATCH', body: json(fields) });
export const deleteTask = (id) => request(`/tasks/${id}`, { method: 'DELETE' });
export const deleteTasks = (ids) => request('/tasks/delete-many', { method: 'POST', body: json({ ids }) });

// Subtasks (also used for goal steps)
export const listSubtasksByTask = (taskId) => request(`/subtasks?task_id=${taskId}`);
export const insertSubtasks = (rows) => request('/subtasks', { method: 'POST', body: json({ rows }) });
export const updateSubtask = (id, fields) => request(`/subtasks/${id}`, { method: 'PATCH', body: json(fields) });
export const deleteSubtasks = (ids) => request('/subtasks/delete-many', { method: 'POST', body: json({ ids }) });

// Snooze events
export const insertSnoozeEvent = (taskId) => request('/snooze-events', { method: 'POST', body: json({ task_id: taskId }) });
export const listSnoozeEventsSince = (sinceIso) => request(`/snooze-events?since=${encodeURIComponent(sinceIso)}`);

// Habits
export const listHabits = () => request('/habits');
export const createHabit = (fields) => request('/habits', { method: 'POST', body: json(fields) });
export const updateHabit = (id, fields) => request(`/habits/${id}`, { method: 'PATCH', body: json(fields) });
export const upsertHabitCompletion = (habitId, dateKey, count) => (
  request(`/habits/${habitId}/completions/${dateKey}`, { method: 'PUT', body: json({ count }) })
);
