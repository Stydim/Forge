import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import { parseBookFile } from './server/bookParsers.js';

// pg's default DATE parser builds a JS Date at local-timezone midnight, which
// shifts the calendar day by the server's UTC offset once serialized back to
// JSON (e.g. '2026-08-31' -> '2026-08-30T21:00:00.000Z' at UTC+3). The app
// only ever wants the plain 'YYYY-MM-DD' string, so skip Date parsing for it.
pg.types.setTypeParser(1082, (val) => val);

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DIST = join(__dirname, 'dist');

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-fast';
const GROK_URL = 'https://api.x.ai/v1/chat/completions';

// All Forge tables live in their own `forge` schema on a Postgres instance
// shared with other apps (each in its own schema) — never touch `public` or
// any other schema from here.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

async function callGrok(messages, { maxTokens = 250, timeoutMs = 15000 } = {}) {
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
    signal: AbortSignal.timeout(timeoutMs),
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

// Reader feature: bilingual RU<->EN book reading with on-demand Grok
// translation (lazy, only what's actually read) and per-word AI glosses.
const LANG_NAMES_FROM = { ru: 'русского', en: 'английского' };
const LANG_NAMES_TO = { ru: 'русский', en: 'английский' };

async function translateParagraphs(paragraphs, sourceLang, targetLang) {
  const numbered = paragraphs.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const parsed = await callGrok([
    {
      role: 'system',
      content: `Ты профессиональный литературный переводчик. Переведи пронумерованные абзацы книги с ${LANG_NAMES_FROM[sourceLang]} языка на ${LANG_NAMES_TO[targetLang]} язык, сохраняя стиль, тон и смысл оригинала как можно точнее.
Ответь СТРОГО JSON без пояснений и без markdown-разметки: {"translations": [string, ...]} — ровно ${paragraphs.length} элемент(ов) в том же порядке, без номеров внутри самого текста перевода.`,
    },
    { role: 'user', content: numbered },
  ], { maxTokens: Math.min(6000, paragraphs.length * 250 + 200), timeoutMs: 45000 });

  const translations = Array.isArray(parsed.translations) ? parsed.translations : [];
  if (translations.length !== paragraphs.length) {
    throw new Error(`Grok translation count mismatch: expected ${paragraphs.length}, got ${translations.length}`);
  }
  return translations;
}

async function glossWord(word, context, sourceLang, targetLang) {
  const parsed = await callGrok([
    {
      role: 'system',
      content: `Ты даёшь краткую словарную справку по слову из текста на ${LANG_NAMES_FROM[sourceLang]} языке для человека, который изучает этот язык. Слово дано в контексте предложения — определи его начальную форму (лемму), часть речи, точный перевод на ${LANG_NAMES_TO[targetLang]} язык именно в этом контексте, и короткий учебный пример: одно отдельное предложение на исходном языке с переводом.
Ответь СТРОГО JSON без пояснений и без markdown-разметки:
{"base_form": string, "part_of_speech": string, "translation": string, "example_source": string, "example_translation": string}
"part_of_speech" — кратко в стиле словаря (например "сущ. · ж. р.", "гл. · несов. в.", "noun", "verb").`,
    },
    { role: 'user', content: `Слово: «${word}». Предложение из текста: «${context}».` },
  ], { maxTokens: 300 });

  if (!parsed.base_form || !parsed.translation) throw new Error('Grok не вернул перевод слова');
  return parsed;
}

const REPEAT_TYPES = new Set(['none', 'daily', 'weekly', 'weekdays', 'weekends', 'monthly', 'yearly', 'custom_days']);
const REPEAT_END_TYPES = new Set(['never', 'count', 'date']);
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
{"title": string, "due_at": string|null, "due_has_time": boolean, "repeat_type": string, "repeat_days": string[]|null, "times_per_day": number, "repeat_end_type": string, "repeat_count": number|null, "repeat_end_date": string|null}
"title" — короткая суть задачи без упоминаний даты/времени/повтора.
"due_at" — дата/время первого выполнения в ISO 8601 с таймзоной, если срок упомянут явно или косвенно; иначе null.
"due_has_time" — true, если было названо конкретное время суток; false, если только дата (или срока нет вовсе).
"repeat_type" — одно из: "none" (повтора нет), "daily", "weekly" (раз в неделю, в тот же день недели что и due_at), "weekdays" (по будням), "weekends" (по выходным), "monthly", "yearly", "custom_days" (конкретные дни недели).
Используй "custom_days" всегда, когда упомянуто больше одного дня недели — например "сегодня и во вторник" значит custom_days с обоими днями (сегодняшним и вторником), а не просто "во вторник".
"repeat_days" — массив из "mon","tue","wed","thu","fri","sat","sun", ТОЛЬКО когда repeat_type="custom_days"; иначе null.
"times_per_day" — сколько раз в день выполняется (целое число 1-10); если не указано явно — 1.
"repeat_end_type" — когда серия заканчивается: "count" (после конкретного числа повторов), "date" (до конкретной даты), "never" (повтор постоянный, без конца).
ВАЖНО: если repeat_type="custom_days" и дни просто перечислены как конкретный список без слов "каждый/каждую/по" (например "сегодня и во вторник", "в среду и в пятницу на этой неделе") — это одноразовый проход по списку, а НЕ постоянный повтор. Тогда "repeat_end_type"="count" и "repeat_count" = количество дней в repeat_days (серия пройдёт по разу каждый день из списка и остановится).
Если явно сказано "каждый"/"каждую"/"по вторникам и субботам" и т.п. — это постоянный повтор, "repeat_end_type"="never".
Если названо конкретное число повторов ("3 раза", "5 подходов") — "repeat_end_type"="count", "repeat_count" = это число.
Если названа дата окончания ("до 10 сентября") — "repeat_end_type"="date", "repeat_end_date" = эта дата в ISO 8601.
Для daily/weekly/weekdays/weekends/monthly/yearly без явного признака конца — "repeat_end_type"="never".
"repeat_count" — число или null (только когда repeat_end_type="count").
"repeat_end_date" — дата в ISO 8601 или null (только когда repeat_end_type="date").`,
      },
      { role: 'user', content: text },
    ], { maxTokens: 300 });

    const repeatType = REPEAT_TYPES.has(parsed.repeat_type) ? parsed.repeat_type : 'none';
    const repeatDays = repeatType === 'custom_days' && Array.isArray(parsed.repeat_days)
      ? parsed.repeat_days.filter((d) => WEEKDAY_TOKENS.has(d))
      : null;
    const timesPerDay = Number.isInteger(parsed.times_per_day)
      ? Math.min(Math.max(parsed.times_per_day, 1), 10)
      : 1;
    let repeatEndType = REPEAT_END_TYPES.has(parsed.repeat_end_type) ? parsed.repeat_end_type : 'never';
    const repeatCount = repeatEndType === 'count' && Number.isInteger(parsed.repeat_count) && parsed.repeat_count > 0
      ? parsed.repeat_count
      : null;
    const repeatEndDate = repeatEndType === 'date' && typeof parsed.repeat_end_date === 'string'
      ? parsed.repeat_end_date
      : null;
    // Fall back to "never" if the type doesn't have the value it needs, or
    // there's no repeat at all to end.
    if (repeatType === 'none') repeatEndType = 'never';
    else if (repeatEndType === 'count' && !repeatCount) repeatEndType = 'never';
    else if (repeatEndType === 'date' && !repeatEndDate) repeatEndType = 'never';

    const rawTitle = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : text;

    res.json({
      title: rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1),
      due_at: typeof parsed.due_at === 'string' ? parsed.due_at : null,
      due_has_time: parsed.due_has_time !== false,
      repeat_type: repeatType,
      repeat_days: repeatDays && repeatDays.length ? repeatDays : null,
      times_per_day: timesPerDay,
      repeat_end_type: repeatEndType,
      repeat_count: repeatEndType === 'count' ? repeatCount : null,
      repeat_end_date: repeatEndType === 'date' ? repeatEndDate : null,
    });
  } catch (err) {
    console.error('parse-task failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/gnome-message', async (req, res) => {
  try {
    const { characterName, characterPower, characterHelps, stage, taskTitle, snoozeCount, dueStatus } = req.body || {};
    if (!taskTitle || !stage) return res.status(400).json({ error: 'taskTitle and stage are required' });

    const dueLine = dueStatus
      ? `Статус срока задачи: ${dueStatus}.
Если срок ещё не наступил — задача просто предстоит, она НЕ просрочена и на неё пока не откладывались. НЕ говори, что она просрочена, забыта или что её "опять" не сделали — тон спокойный, дружелюбный, максимум лёгкое ненавязчивое напоминание о том, что задача есть в списке. Ступень эскалации в этом случае всё равно 1 (снооз ещё не было), но говори именно как про предстоящее дело, а не как про долг.
Если задача уже просрочена — ориентируйся на ступень эскалации как обычно.`
      : '';

    const parsed = await callGrok([
      {
        role: 'system',
        content: `Ты играешь роль персонажа-напоминалки в приложении для задач.
Персонаж: «${characterName}».
Его суть: ${characterPower || ''} ${characterHelps || ''}
Пользователь отложил задачу «${taskTitle}» ${snoozeCount ?? 0} раз(а). Это определяет ступень эскалации: ${stage}.
${dueLine}
Ступень 1 — максимально мягко и спокойно. Дальше нет потолка: чем выше ступень, тем сильнее нарастает эмоция (усталость, сарказм, чёрный юмор, драматичное отчаяние на очень высоких ступенях) — но всегда без грубости и оскорблений личности.
Придумай ДВЕ короткие фразы от лица персонажа (каждая до 90 символов) в тоне, точно соответствующем ступени ${stage} (и статусу срока выше, если он есть). Это должны быть свежие формулировки — не используй шаблонные фразы вроде "энный раз напоминаю", придумывай каждый раз по-новому.
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

// ---------------------------------------------------------------------------
// Data API (forge schema on Render Postgres) — replaces direct supabase-js
// table access. Column lists below are allowlists for dynamic insert/patch
// query building; names never come from the request itself, so there's no
// injection surface even though the SQL text is assembled per-request.
const TASK_COLUMNS = [
  'kind', 'title', 'due_at', 'due_has_time', 'recurrence_note', 'repeat_type', 'repeat_days',
  'times_per_day', 'repeat_end_type', 'repeat_end_date', 'repeat_occurrences_left',
  'reminder_count', 'snooze_count', 'completed', 'completed_at',
];
const SUBTASK_COLUMNS = ['task_id', 'label', 'done', 'position'];
const HABIT_COLUMNS = ['title', 'icon', 'color', 'target_days', 'times_per_day', 'archived'];

function buildInsert(table, allowedCols, body) {
  const cols = Object.keys(body).filter((k) => allowedCols.includes(k));
  if (cols.length === 0) throw new Error('No valid fields to insert');
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const values = cols.map((c) => body[c]);
  return { text: `insert into forge.${table} (${colList}) values (${placeholders}) returning *`, values };
}

function buildPatch(table, allowedCols, id, body) {
  const cols = Object.keys(body).filter((k) => allowedCols.includes(k));
  if (cols.length === 0) throw new Error('No valid fields to update');
  const setClause = cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
  const values = cols.map((c) => body[c]);
  return { text: `update forge.${table} set ${setClause} where id = $1 returning *`, values: [id, ...values] };
}

// --- Tasks ---
app.get('/api/tasks', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      select t.*,
        (select coalesce(json_agg(sub order by sub.position), '[]'::json)
           from forge.subtasks sub where sub.task_id = t.id) as subtasks
      from forge.tasks t
      where t.completed = false
      order by t.created_at asc
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tasks/archive', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'select * from forge.tasks where completed = true order by completed_at desc'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/tasks/completed-stats', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'select completed_at, due_at, snooze_count from forge.tasks where completed = true'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { text, values } = buildInsert('tasks', TASK_COLUMNS, req.body);
    const { rows } = await pool.query(text, values);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { text, values } = buildPatch('tasks', TASK_COLUMNS, req.params.id, req.body);
    const { rows } = await pool.query(text, values);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await pool.query('delete from forge.tasks where id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks/delete-many', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length) await pool.query('delete from forge.tasks where id = any($1::uuid[])', [ids]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Subtasks (also used for goal steps) ---
app.get('/api/subtasks', async (req, res) => {
  try {
    const { task_id } = req.query;
    if (!task_id) return res.status(400).json({ error: 'task_id is required' });
    const { rows } = await pool.query(
      'select * from forge.subtasks where task_id = $1 order by position', [task_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subtasks', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const inserted = [];
    for (const row of rows) {
      const { text, values } = buildInsert('subtasks', SUBTASK_COLUMNS, row);
      const { rows: r } = await pool.query(text, values);
      inserted.push(r[0]);
    }
    res.json(inserted);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch('/api/subtasks/:id', async (req, res) => {
  try {
    const { text, values } = buildPatch('subtasks', SUBTASK_COLUMNS, req.params.id, req.body);
    const { rows } = await pool.query(text, values);
    if (!rows.length) return res.status(404).json({ error: 'Subtask not found' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/subtasks/delete-many', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length) await pool.query('delete from forge.subtasks where id = any($1::uuid[])', [ids]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Snooze events ---
app.post('/api/snooze-events', async (req, res) => {
  try {
    await pool.query('insert into forge.snooze_events (task_id) values ($1)', [req.body.task_id]);
    res.status(204).end();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/snooze-events', async (req, res) => {
  try {
    const { since } = req.query;
    if (!since) return res.status(400).json({ error: 'since is required' });
    const { rows } = await pool.query(
      'select occurred_at from forge.snooze_events where occurred_at >= $1', [since]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Habits ---
app.get('/api/habits', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      select h.*,
        (select coalesce(json_agg(hc), '[]'::json)
           from forge.habit_completions hc where hc.habit_id = h.id) as habit_completions
      from forge.habits h
      where h.archived = false
      order by h.created_at asc
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/habits', async (req, res) => {
  try {
    const { text, values } = buildInsert('habits', HABIT_COLUMNS, req.body);
    const { rows } = await pool.query(text, values);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch('/api/habits/:id', async (req, res) => {
  try {
    const { text, values } = buildPatch('habits', HABIT_COLUMNS, req.params.id, req.body);
    const { rows } = await pool.query(text, values);
    if (!rows.length) return res.status(404).json({ error: 'Habit not found' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/habits/:habitId/completions/:date', async (req, res) => {
  try {
    const { habitId, date } = req.params;
    const { count } = req.body;
    const { rows } = await pool.query(`
      insert into forge.habit_completions (habit_id, date, count)
      values ($1, $2, $3)
      on conflict (habit_id, date) do update set count = excluded.count
      returning *
    `, [habitId, date, count]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- Reader: books ---
const BOOK_FORMATS = new Set(['epub', 'fb2', 'txt']);
const SPINE_COLORS = ['#FF6A3D', '#5CC8E0', '#ECEAE4', '#2C3140', '#B8432A', '#3A6F7B', '#1F2228', '#D9D3C4'];
const BOOK_COLUMNS = ['title', 'author', 'current_paragraph', 'shelf_slot'];

app.post('/api/books', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
    const sourceLang = req.body.source_lang === 'en' ? 'en' : 'ru';
    const targetLang = sourceLang === 'ru' ? 'en' : 'ru';

    const name = req.file.originalname || '';
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (!BOOK_FORMATS.has(ext)) return res.status(400).json({ error: 'Поддерживаются только TXT, EPUB и FB2' });

    const parsed = await parseBookFile(req.file.buffer, ext);
    const title = (req.body.title || parsed.title || name.replace(/\.[^.]+$/, '') || 'Без названия').trim();
    const author = (req.body.author || parsed.author || '').trim() || null;
    const spineColor = SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];

    const { rows } = await pool.query(
      `insert into forge.books (title, author, source_lang, target_lang, format, spine_color, paragraph_count)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [title, author, sourceLang, targetLang, ext, spineColor, parsed.paragraphs.length]
    );
    const book = rows[0];
    await insertParagraphs(book.id, 0, parsed.paragraphs);
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Chunked insert keeps this well under Postgres' bind-parameter limit
// regardless of how long the book is. Returns the inserted rows in order.
async function insertParagraphs(bookId, startPosition, paragraphs) {
  const CHUNK = 500;
  const inserted = [];
  for (let i = 0; i < paragraphs.length; i += CHUNK) {
    const chunk = paragraphs.slice(i, i + CHUNK);
    const values = [];
    const placeholders = chunk.map((text, j) => {
      values.push(bookId, startPosition + i + j, text);
      return `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`;
    }).join(', ');
    const { rows } = await pool.query(
      `insert into forge.book_paragraphs (book_id, position, text) values ${placeholders} returning *`,
      values
    );
    inserted.push(...rows.sort((a, b) => a.position - b.position));
  }
  return inserted;
}

// --- Reader: pasted-text "books" ---
// A user can start an empty book, paste text into it and get the translation
// right away. Pasted text is short, so unlike uploaded files it's translated
// eagerly (in page-sized batches) instead of lazily on read.
const PASTE_MAX_CHARS = 30000;

// Text copied from a web page usually has one paragraph per line; text with
// blank lines between paragraphs is often hard-wrapped inside them, so in
// that case blank lines are the paragraph breaks and inner newlines are joined.
function splitPastedText(text) {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  const blocks = /\n\s*\n/.test(normalized) ? normalized.split(/\n\s*\n/) : normalized.split('\n');
  return blocks.map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function detectLang(text) {
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return cyr >= lat ? 'ru' : 'en';
}

async function translateAndStore(rows, sourceLang, targetLang) {
  const BATCH = 15;
  const result = [...rows];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      const translations = await translateParagraphs(batch.map((r) => r.text), sourceLang, targetLang);
      for (let j = 0; j < batch.length; j++) {
        const updated = await pool.query(
          'update forge.book_paragraphs set translation = $1, translated_at = now() where id = $2 returning *',
          [translations[j], batch[j].id]
        );
        result[i + j] = updated.rows[0];
      }
    } catch (err) {
      // Left untranslated — the reader translates it lazily on open anyway.
      console.error('translateParagraphs (paste) failed:', err.message);
    }
  }
  return result;
}

function readPastedParagraphs(body) {
  const text = typeof body?.text === 'string' ? body.text : '';
  if (text.length > PASTE_MAX_CHARS) throw new Error(`Слишком длинный текст — не больше ${PASTE_MAX_CHARS} символов за раз`);
  const paragraphs = splitPastedText(text);
  if (paragraphs.length === 0) throw new Error('Вставьте текст для перевода');
  return paragraphs;
}

app.post('/api/books/text', async (req, res) => {
  try {
    const paragraphs = readPastedParagraphs(req.body);
    const sourceLang = ['ru', 'en'].includes(req.body.source_lang) ? req.body.source_lang : detectLang(paragraphs.join(' '));
    const targetLang = sourceLang === 'ru' ? 'en' : 'ru';
    const title = (req.body.title || '').trim() || 'Мои тексты';
    const author = (req.body.author || '').trim() || null;
    const spineColor = SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];

    const { rows } = await pool.query(
      `insert into forge.books (title, author, source_lang, target_lang, format, spine_color, paragraph_count)
       values ($1,$2,$3,$4,'txt',$5,$6) returning *`,
      [title, author, sourceLang, targetLang, spineColor, paragraphs.length]
    );
    const book = rows[0];
    const inserted = await insertParagraphs(book.id, 0, paragraphs);
    res.json({ book, paragraphs: await translateAndStore(inserted, sourceLang, targetLang) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Appends more pasted text to the end of an existing book.
app.post('/api/books/:id/text', async (req, res) => {
  try {
    const paragraphs = readPastedParagraphs(req.body);
    const { rows } = await pool.query(
      'update forge.books set paragraph_count = paragraph_count + $2 where id = $1 returning *',
      [req.params.id, paragraphs.length]
    );
    if (!rows.length) return res.status(404).json({ error: 'Книга не найдена' });
    const book = rows[0];
    const inserted = await insertParagraphs(book.id, book.paragraph_count - paragraphs.length, paragraphs);
    res.json({ book, paragraphs: await translateAndStore(inserted, book.source_lang, book.target_lang) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/books', async (_req, res) => {
  try {
    const { rows } = await pool.query('select * from forge.books order by created_at desc');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('select * from forge.books where id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Книга не найдена' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/books/:id', async (req, res) => {
  try {
    // A shelf place holds one book: putting a book there takes it off from
    // whichever book stood there before.
    if (req.body?.shelf_slot != null) {
      await pool.query('update forge.books set shelf_slot = null where shelf_slot = $1 and id <> $2', [req.body.shelf_slot, req.params.id]);
    }
    const { text, values } = buildPatch('books', BOOK_COLUMNS, req.params.id, req.body);
    const { rows } = await pool.query(text, values);
    if (!rows.length) return res.status(404).json({ error: 'Книга не найдена' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    await pool.query('delete from forge.books where id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serves a page of paragraphs, translating (and caching) any that haven't
// been read yet in one batched Grok call — so cost/latency only hits what's
// actually opened, not the whole book at upload time.
app.get('/api/books/:id/paragraphs', async (req, res) => {
  try {
    const bookRes = await pool.query('select * from forge.books where id = $1', [req.params.id]);
    if (!bookRes.rows.length) return res.status(404).json({ error: 'Книга не найдена' });
    const book = bookRes.rows[0];

    const from = Math.max(0, parseInt(req.query.from, 10) || 0);
    const count = Math.min(50, Math.max(1, parseInt(req.query.count, 10) || 20));

    const { rows } = await pool.query(
      'select * from forge.book_paragraphs where book_id = $1 and position >= $2 and position < $3 order by position',
      [book.id, from, from + count]
    );

    const missing = rows.filter((r) => r.translation == null);
    if (missing.length > 0) {
      try {
        const translations = await translateParagraphs(missing.map((r) => r.text), book.source_lang, book.target_lang);
        for (let i = 0; i < missing.length; i++) {
          const updated = await pool.query(
            'update forge.book_paragraphs set translation = $1, translated_at = now() where id = $2 returning *',
            [translations[i], missing[i].id]
          );
          rows[rows.findIndex((r) => r.id === missing[i].id)] = updated.rows[0];
        }
      } catch (err) {
        console.error('translateParagraphs failed:', err.message);
        // Serve the original text untranslated rather than failing the page.
      }
    }

    res.json({ book, paragraphs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Reader: quotes (shown in the frame on the library shelf) ---
// The frame shows the pinned quote; a newly saved quote becomes the pinned one.
app.get('/api/quotes', async (_req, res) => {
  try {
    const { rows } = await pool.query('select * from forge.quotes order by pinned desc, created_at desc');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/quotes', async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Пустая цитата' });
    if (text.length > 2000) return res.status(400).json({ error: 'Слишком длинная цитата — не больше 2000 символов' });
    const author = (req.body.author || '').trim() || null;
    let bookId = req.body.book_id || null;
    let bookTitle = null;
    if (bookId) {
      const b = await pool.query('select title from forge.books where id = $1', [bookId]);
      if (b.rows.length) bookTitle = b.rows[0].title; else bookId = null;
    }
    await pool.query('update forge.quotes set pinned = false where pinned');
    const { rows } = await pool.query(
      'insert into forge.quotes (text, author, book_id, book_title, pinned) values ($1,$2,$3,$4,true) returning *',
      [text, author, bookId, bookTitle]
    );
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/quotes/:id/pin', async (req, res) => {
  try {
    await pool.query('update forge.quotes set pinned = (id = $1) where pinned or id = $1', [req.params.id]);
    const { rows } = await pool.query('select * from forge.quotes where id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Цитата не найдена' });
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/quotes/:id', async (req, res) => {
  try {
    await pool.query('delete from forge.quotes where id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Reader: text-to-speech (ElevenLabs, cached) ---
// One multilingual model reads both Russian and English; the voice can be
// set per language. Generated audio is cached by (voice, model, text) so
// replaying a word or paragraph never costs a second ElevenLabs request.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const ELEVENLABS_VOICES = {
  ru: process.env.ELEVENLABS_VOICE_ID_RU || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
  en: process.env.ELEVENLABS_VOICE_ID_EN || process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
};
const TTS_MAX_CHARS = 2500;

app.post('/api/tts', async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    const lang = req.body?.lang === 'en' ? 'en' : 'ru';
    if (!text) return res.status(400).json({ error: 'Нет текста для озвучки' });
    if (text.length > TTS_MAX_CHARS) return res.status(400).json({ error: `Слишком длинный текст для озвучки (больше ${TTS_MAX_CHARS} символов)` });

    const voice = ELEVENLABS_VOICES[lang];
    const key = createHash('sha256').update(`${voice}\n${ELEVENLABS_MODEL}\n${text}`).digest('hex');
    const cached = await pool.query('select audio from forge.tts_cache where key = $1', [key]);
    if (cached.rows.length) {
      res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable' });
      return res.send(cached.rows[0].audio);
    }

    if (!ELEVENLABS_API_KEY) return res.status(503).json({ error: 'Озвучка не настроена: на сервере нет ELEVENLABS_API_KEY' });
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`ElevenLabs ${r.status}: ${body.slice(0, 500)}`);
      if (r.status === 401 || body.includes('invalid_api_key')) throw new Error('ElevenLabs не принял ключ API — нужен сам ключ (начинается с sk_), а не его ID');
      if (r.status === 429 || body.includes('quota')) throw new Error('ElevenLabs: закончилась квота или слишком много запросов');
      throw new Error(`ElevenLabs ${r.status}: ${body.slice(0, 200)}`);
    }
    const audio = Buffer.from(await r.arrayBuffer());
    await pool.query('insert into forge.tts_cache (key, audio) values ($1, $2) on conflict (key) do nothing', [key, audio]);
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable' });
    res.send(audio);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Reader: word gloss (cached AI dictionary lookups) ---
app.post('/api/words/gloss', async (req, res) => {
  try {
    const { word, context, source_lang, target_lang } = req.body || {};
    if (!word || !source_lang || !target_lang) {
      return res.status(400).json({ error: 'word, source_lang и target_lang обязательны' });
    }
    const normalized = word.trim();

    const cached = await pool.query(
      'select * from forge.word_glosses where word = $1 and source_lang = $2 and target_lang = $3',
      [normalized, source_lang, target_lang]
    );
    if (cached.rows.length) return res.json(cached.rows[0]);

    const gloss = await glossWord(normalized, context || '', source_lang, target_lang);
    const { rows } = await pool.query(`
      insert into forge.word_glosses (word, source_lang, target_lang, base_form, part_of_speech, translation, example_source, example_translation)
      values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (word, source_lang, target_lang) do update set base_form = excluded.base_form
      returning *
    `, [
      normalized, source_lang, target_lang, gloss.base_form,
      gloss.part_of_speech || null, gloss.translation,
      gloss.example_source || null, gloss.example_translation || null,
    ]);
    res.json(rows[0]);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Reader: saved-words deck (Leitner-box SRS) ---
const LEITNER_INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];

app.post('/api/saved-words', async (req, res) => {
  try {
    const { word, base_form, source_lang, translation, part_of_speech, example_source, example_translation, book_id } = req.body || {};
    if (!word || !base_form || !source_lang || !translation) {
      return res.status(400).json({ error: 'Не хватает полей для сохранения слова' });
    }
    const { rows } = await pool.query(`
      insert into forge.saved_words (word, base_form, source_lang, translation, part_of_speech, example_source, example_translation, book_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning *
    `, [word, base_form, source_lang, translation, part_of_speech || null, example_source || null, example_translation || null, book_id || null]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/saved-words', async (_req, res) => {
  try {
    const { rows } = await pool.query('select * from forge.saved_words order by created_at desc');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/saved-words/due', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'select * from forge.saved_words where next_review_at <= now() order by next_review_at asc'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/saved-words/:id/review', async (req, res) => {
  try {
    const grade = req.body?.grade === 'good' ? 'good' : 'again';
    const current = await pool.query('select * from forge.saved_words where id = $1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Слово не найдено' });
    const box = grade === 'good' ? Math.min(current.rows[0].familiarity + 1, 5) : 0;
    const days = LEITNER_INTERVAL_DAYS[box];
    const { rows } = await pool.query(`
      update forge.saved_words
      set familiarity = $1, review_count = review_count + 1, next_review_at = now() + ($2 || ' days')::interval
      where id = $3
      returning *
    `, [box, days, req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/saved-words/:id', async (req, res) => {
  try {
    await pool.query('delete from forge.saved_words where id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));
// Additive, idempotent schema upgrades for columns added after the initial
// db/schema.sql was applied — keeps deploys self-sufficient.
async function migrate() {
  await pool.query('alter table forge.books add column if not exists shelf_slot integer');
  await pool.query(`
    create table if not exists forge.tts_cache (
      key text primary key,
      audio bytea not null,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists forge.quotes (
      id uuid primary key default gen_random_uuid(),
      text text not null,
      author text,
      book_id uuid references forge.books(id) on delete set null,
      book_title text,
      pinned boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);
}

migrate()
  .catch((err) => console.error('migrate failed:', err.message))
  .finally(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)));
