const { put, list, del } = require("@vercel/blob");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const KEEP = 14;

async function runBackup() {
  const tables = ["posts", "post_history", "credit_snapshots", "image_library"];
  const dump = { backed_up_at: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    try {
      dump.tables[table] = await sql.query(`SELECT * FROM ${table}`);
    } catch (err) {
      dump.tables[table] = { error: err.message };
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const blob = await put(`backups/backup-${stamp}.json`, JSON.stringify(dump, null, 1), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  const rowCount = Object.values(dump.tables)
    .filter(Array.isArray)
    .reduce((sum, rows) => sum + rows.length, 0);

  // Xoa backup cu, giu KEEP ban gan nhat
  const { blobs } = await list({ prefix: "backups/" });
  const sorted = blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  while (sorted.length > KEEP) {
    const old = sorted.shift();
    await del(old.url);
  }

  return { url: blob.url, rowCount };
}

module.exports = { runBackup };
