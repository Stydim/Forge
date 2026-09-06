import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DIST = join(__dirname, 'dist');

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-fast';
const GROK_URL = 'https://api.x.ai/v1/chat/completions';

app.use(express.json());

// Grok sometimes wraps JSON in prose or a ```json fence even when asked for
// raw JSON — try a direct parse first, then fall back to pulling out the
// first {...} block.
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw new Error('Grok response was not valid JSON');
  }
}

async function callGrok(messages, { maxTokens = 250 } = {}) {
  if (!GROK_API_KEY) throw new Error('GROK_API_KEY is not configured on the server');

  const res = await fetch(GROK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Grok API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Grok response had no content');
  return extractJson(content);
}

const REPEAT_TYPES = new Set(['none', 'daily', 'weekly', 'weekdays', 'weekends', 'monthly', 'yearly', 'custom_days']);
const WEEKDAY_TOKENS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const WEEKDAY_NAMES_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

app.post('/api/parse-task', async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });

    const now = new Date();
    const parsed = await callGrok([
      {
        role: 'system',
        content: `Ты превращаешь свободный текст на русском в структурированную задачу для трекера дел.
Текущая дата и время: ${now.toISOString()} (это ${WEEKDAY_NAMES_RU[now.getDay()]}) — используй как точку отсчёта для относительных сроков ("завтра", "через час", "в пятницу", "в понедельник").
Ответь СТРОГО JSON без пояснений и без markdown-разметки:
{"title": string, "due_at": string|null, "due_has_time": boolean, "repeat_type": string, "repeat_days": string[]|null, "times_per_day": number}
"title" — короткая суть задачи без упоминаний даты/времени/повтора.
"due_at" — дата/время первого выполнения в ISO 8601 с таймзоной, если срок упомянут явно или косвенно; иначе null.
"due_has_time" — true, если было названо конкретное время суток; false, если только дата (или срока нет вовсе).
"repeat_type" — одно из: "none" (повтора нет), "daily", "weekly" (раз в неделю, в тот же день недели что и due_at), "weekdays" (по будням), "weekends" (по выходным), "monthly", "yearly", "custom_days" (конкретные дни недели).
Используй "custom_days" всегда, когда упомянуто больше одного дня недели — например "сегодня и во вторник" значит custom_days с обоими днями (сегодняшним и вторником), а не просто "во вторник".
"repeat_days" — массив из "mon","tue","wed","thu","fri","sat","sun", ТОЛЬКО когда repeat_type="custom_days"; иначе null.
"times_per_day" — сколько раз в день выполняется (целое число 1-10); если не указано явно — 1.`,
      },
      { role: 'user', content: text },
    ], { maxTokens: 250 });

    const repeatType = REPEAT_TYPES.has(parsed.repeat_type) ? parsed.repeat_type : 'none';
    const repeatDays = repeatType === 'custom_days' && Array.isArray(parsed.repeat_days)
      ? parsed.repeat_days.filter((d) => WEEKDAY_TOKENS.has(d))
      : null;
    const timesPerDay = Number.isInteger(parsed.times_per_day)
      ? Math.min(Math.max(parsed.times_per_day, 1), 10)
      : 1;

    res.json({
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : text,
      due_at: typeof parsed.due_at === 'string' ? parsed.due_at : null,
      due_has_time: parsed.due_has_time !== false,
      repeat_type: repeatType,
      repeat_days: repeatDays && repeatDays.length ? repeatDays : null,
      times_per_day: timesPerDay,
    });
  } catch (err) {
    console.error('parse-task failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/gnome-message', async (req, res) => {
  try {
    const { characterName, characterPower, characterHelps, stage, taskTitle, snoozeCount } = req.body || {};
    if (!taskTitle || !stage) return res.status(400).json({ error: 'taskTitle and stage are required' });

    const parsed = await callGrok([
      {
        role: 'system',
        content: `Ты играешь роль персонажа-напоминалки в приложении для задач.
Персонаж: «${characterName}».
Его суть: ${characterPower || ''} ${characterHelps || ''}
Пользователь отложил задачу «${taskTitle}» ${snoozeCount ?? 0} раз(а). Это определяет ступень эскалации: ${stage}.
Ступень 1 — максимально мягко и спокойно. Дальше нет потолка: чем выше ступень, тем сильнее нарастает эмоция (усталость, сарказм, чёрный юмор, драматичное отчаяние на очень высоких ступенях) — но всегда без грубости и оскорблений личности.
Придумай ДВЕ короткие фразы от лица персонажа (каждая до 90 символов) в тоне, точно соответствующем ступени ${stage}. Это должны быть свежие формулировки — не используй шаблонные фразы вроде "энный раз напоминаю", придумывай каждый раз по-новому.
Ответь СТРОГО JSON без пояснений и без markdown-разметки: {"lines": [string, string]}.`,
      },
      { role: 'user', content: `Ступень ${stage}, задача «${taskTitle}».` },
    ], { maxTokens: 200 });

    const lines = Array.isArray(parsed.lines) ? parsed.lines.filter((l) => typeof l === 'string').slice(0, 2) : [];
    if (lines.length === 0) throw new Error('Grok returned no usable lines');
    res.json({ lines });
  } catch (err) {
    console.error('gnome-message failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
