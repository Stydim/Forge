// One-off import of notes from Sanct (same Postgres instance, its own `public`
// schema) into forge.notes / note_categories / note_images: categories with
// their order, notes with created/updated dates, order and archive flag, and
// the images they embed (re-pointed from /api/images/… to /api/note-images/…).
// Read-only on Sanct's side; safe to re-run — rows keep Sanct's ids, existing
// notes and images are skipped (categories take Sanct's name/colour/order).
//
//   node scripts/import-sanct-notes.js [sanct-user-email]
//
// Run after the server has started once (its migrate() creates the tables).
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const IMAGE_RE = /\/api\/images\/([0-9a-f-]{36})/g;

async function main() {
  const email = process.argv[2];
  const { rows: users } = await pool.query(
    `select distinct u.id, u.email from public.users u
       join public.user_data d on d.user_id = u.id and d.key = 'notes'
      where $1::text is null or u.email = $1`,
    [email || null],
  );
  if (users.length !== 1) {
    throw new Error(users.length
      ? `Several Sanct users have notes (${users.map((u) => u.email).join(', ')}) — pass an email`
      : 'No Sanct notes found');
  }
  const user = users[0];
  const { rows: data } = await pool.query(
    `select key, value from public.user_data where user_id = $1 and key in ('notes', 'noteCategories')`,
    [user.id],
  );
  const notes = data.find((d) => d.key === 'notes')?.value || [];
  const categories = data.find((d) => d.key === 'noteCategories')?.value || [];

  for (const [i, c] of categories.entries()) {
    await pool.query(
      `insert into forge.note_categories (id, name, color, position) values ($1, $2, $3, $4)
       on conflict (id) do update set name = excluded.name, color = excluded.color, position = excluded.position`,
      [c.id, c.name, c.color || '#6C5CE7', i],
    );
  }

  let added = 0;
  let images = 0;
  for (const n of notes) {
    if (!n.id) continue;
    const content = n.content || '';
    for (const [, imageId] of content.matchAll(IMAGE_RE)) {
      const { rowCount } = await pool.query(
        `insert into forge.note_images (id, content_type, data, created_at)
         select id, content_type, data, created_at from public.images where id = $1 and user_id = $2
         on conflict (id) do nothing`,
        [imageId, user.id],
      );
      images += rowCount;
    }
    const { rowCount } = await pool.query(
      `insert into forge.notes (id, title, content, category_id, archived, sort_order, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do nothing`,
      [
        n.id, n.title || '', content.replace(IMAGE_RE, '/api/note-images/$1'), n.category || null,
        !!n.archived, Number.isInteger(n.sortOrder) ? n.sortOrder : null,
        n.createdAt || new Date().toISOString(), n.updatedAt || n.createdAt || new Date().toISOString(),
      ],
    );
    added += rowCount;
  }
  console.log(`${user.email}: ${categories.length} categories, ${notes.length} Sanct notes, ${added} imported, ${images} images copied`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
