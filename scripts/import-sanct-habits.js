// One-off import of habits from Sanct (same Postgres instance, its own
// `public` schema) into forge.habits / habit_completions: title, icon, colour,
// days, times per day, end date, archive flag, creation date and the full
// completion history. Read-only on Sanct's side; safe to re-run — habits keep
// Sanct's ids and existing ones (and their completions) are skipped.
//
//   node scripts/import-sanct-habits.js [sanct-user-email]
//
// Run after the server has started once (its migrate() adds end_date).
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

// Sanct numbers weekdays 1 (Mon) … 7 (Sun); Forge stores day tokens and
// treats an empty list as "every day".
const DAY_TOKENS = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function targetDays(days) {
  const tokens = [...new Set((days || []).map((d) => DAY_TOKENS[d]).filter(Boolean))];
  return tokens.length === 0 || tokens.length === 7 ? null : tokens;
}

async function main() {
  const email = process.argv[2];
  const { rows: users } = await pool.query(
    `select distinct u.id, u.email from public.users u
       join public.user_data d on d.user_id = u.id and d.key = 'habits'
      where $1::text is null or u.email = $1`,
    [email || null],
  );
  if (users.length !== 1) {
    throw new Error(users.length
      ? `Several Sanct users have habits (${users.map((u) => u.email).join(', ')}) — pass an email`
      : 'No Sanct habits found');
  }
  const user = users[0];
  const { rows: [data] } = await pool.query(
    `select value from public.user_data where user_id = $1 and key = 'habits'`,
    [user.id],
  );
  const habits = data?.value || [];

  let added = 0;
  let marks = 0;
  for (const h of habits) {
    if (!h.id) continue;
    const { rowCount } = await pool.query(
      `insert into forge.habits (id, title, icon, color, target_days, times_per_day, archived, end_date, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do nothing`,
      [
        h.id, h.title || 'Привычка', h.icon || null, h.color || '#1B8A78', targetDays(h.targetDays),
        Math.max(1, h.timesPerDay || 1), !!h.archived, h.endDate || null, h.createdAt || new Date().toISOString(),
      ],
    );
    if (!rowCount) continue;
    added += 1;
    for (const [date, count] of Object.entries(h.completions || {})) {
      if (!(count > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      await pool.query(
        `insert into forge.habit_completions (habit_id, date, count) values ($1, $2, $3)
         on conflict (habit_id, date) do nothing`,
        [h.id, date, count],
      );
      marks += 1;
    }
  }
  console.log(`${user.email}: ${habits.length} Sanct habits, ${added} imported, ${marks} day marks`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
