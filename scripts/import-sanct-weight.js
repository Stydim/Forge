// One-off import of the weight tracker history from Sanct (same Postgres
// instance, its own `public` schema) into forge.weight_logs / weight_settings.
// Read-only on Sanct's side; safe to re-run — rows keep Sanct's ids and
// existing ones are skipped, and the goal is only set if Forge has none yet.
//
//   node scripts/import-sanct-weight.js [sanct-user-email]
//
// Run after the server has started once (its migrate() creates the tables).
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const email = process.argv[2];
  const { rows: users } = await pool.query(
    `select distinct u.id, u.email from public.users u
       join public.user_data d on d.user_id = u.id and d.key = 'weightLogs'
      where $1::text is null or u.email = $1`,
    [email || null],
  );
  if (users.length !== 1) {
    throw new Error(users.length
      ? `Several Sanct users have weight logs (${users.map((u) => u.email).join(', ')}) — pass an email`
      : 'No Sanct weight logs found');
  }
  const user = users[0];

  const { rows: data } = await pool.query(
    `select key, value from public.user_data where user_id = $1 and key in ('weightLogs', 'weightGoal')`,
    [user.id],
  );
  const logs = data.find((d) => d.key === 'weightLogs')?.value || [];
  const goal = data.find((d) => d.key === 'weightGoal')?.value;

  let added = 0;
  for (const log of logs) {
    const value = Number(log.value);
    if (!(value > 0 && value < 500) || !log.date) continue;
    const { rowCount } = await pool.query(
      `insert into forge.weight_logs (id, measured_at, value, note) values ($1, $2, $3, $4)
       on conflict (id) do nothing`,
      [log.id, log.date, value, log.note || ''],
    );
    added += rowCount;
  }

  if (typeof goal === 'number' && goal > 0) {
    await pool.query(
      `insert into forge.weight_settings (id, goal_kg) values (1, $1)
       on conflict (id) do update set goal_kg = coalesce(forge.weight_settings.goal_kg, excluded.goal_kg)`,
      [goal],
    );
  }

  console.log(`${user.email}: ${logs.length} Sanct logs, ${added} imported, goal ${goal ?? '—'}`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
