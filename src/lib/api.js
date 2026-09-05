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
