// One-off import of subscriptions from Sanct (same Postgres instance, its own
// `public` schema) into forge.subscriptions, with their payment history
// (payments_count, previous_billing_date) and auto-task state. Read-only on
// Sanct's side; safe to re-run — rows keep Sanct's ids, existing ones are skipped.
//
//   node scripts/import-sanct-subscriptions.js [sanct-user-email]
//
// Run after the server has started once (its migrate() creates the table).
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const CYCLES = new Set(['weekly', 'monthly', 'quarterly', 'yearly']);
const dateOrNull = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

async function main() {
  const email = process.argv[2];
  const { rows: users } = await pool.query(
    `select distinct u.id, u.email from public.users u
       join public.user_data d on d.user_id = u.id and d.key = 'subscriptions'
      where $1::text is null or u.email = $1`,
    [email || null],
  );
  if (users.length !== 1) {
    throw new Error(users.length
      ? `Several Sanct users have subscriptions (${users.map((u) => u.email).join(', ')}) — pass an email`
      : 'No Sanct subscriptions found');
  }
  const user = users[0];
  const { rows } = await pool.query(
    `select value from public.user_data where user_id = $1 and key = 'subscriptions'`,
    [user.id],
  );
  const subs = rows[0]?.value || [];

  let added = 0;
  for (const s of subs) {
    if (!s.id || !s.name) continue;
    const { rowCount } = await pool.query(
      `insert into forge.subscriptions
         (id, name, amount, currency, cycle, next_billing_date, previous_billing_date, icon, color,
          active, payments_count, auto_task, auto_task_days, auto_task_last_created, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       on conflict (id) do nothing`,
      [
        s.id, s.name, Number(s.amount) || 0, s.currency || '₽', CYCLES.has(s.cycle) ? s.cycle : 'monthly',
        dateOrNull(s.nextBillingDate), dateOrNull(s.previousBillingDate), s.icon || '💳', s.color || '#6C5CE7',
        s.active !== false, s.paymentsCount || 0, !!s.autoTask, s.autoTaskDays ?? 3,
        dateOrNull(s.autoTaskLastCreated), s.createdAt || new Date().toISOString(),
      ],
    );
    added += rowCount;
  }
  console.log(`${user.email}: ${subs.length} Sanct subscriptions, ${added} imported`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
