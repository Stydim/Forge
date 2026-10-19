// Plays ElevenLabs speech fetched through the server's /api/tts. One shared
// <audio> so starting a new clip stops the previous one; fetched clips are
// kept as object URLs for the session so replays are instant.
const urls = new Map();
let audio = null;
let current = null; // { onEnd } of the clip that's playing
let generation = 0; // bumps on every speak/stop so stale fetches don't play

function stopCurrent() {
  generation++;
  if (audio) audio.pause();
  if (current) { const { onEnd } = current; current = null; onEnd?.(); }
}

async function fetchClip(text, lang) {
  const key = `${lang}\n${text}`;
  if (urls.has(key)) return urls.get(key);
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Озвучка недоступна (${res.status})`);
  }
  const url = URL.createObjectURL(await res.blob());
  urls.set(key, url);
  return url;
}

// Resolves true once playback starts, or false if another speak/stop came in
// while the clip was loading. onEnd fires when it ends or is cut off.
export async function speak(text, lang, onEnd) {
  stopCurrent();
  const mine = generation;
  const url = await fetchClip(text, lang);
  if (mine !== generation) return false;
  if (!audio) audio = new Audio();
  const clip = { onEnd };
  current = clip;
  audio.onended = () => { if (current === clip) { current = null; onEnd?.(); } };
  audio.src = url;
  await audio.play();
  return true;
}

export function stopSpeaking() {
  stopCurrent();
}
