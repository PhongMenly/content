/**
 * Backup toan bo du lieu Neon ra file JSON trong thu muc backups/.
 * Giu 14 ban gan nhat, xoa ban cu hon.
 * Duoc goi hang ngay boi cron-runner (hoac chay tay: node scripts/backup-db.js)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);
const BACKUP_DIR = path.join(__dirname, "..", "backups");
const KEEP = 14;

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

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
  const file = path.join(BACKUP_DIR, `backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 1), "utf-8");

  const rowCount = Object.values(dump.tables)
    .filter(Array.isArray)
    .reduce((sum, rows) => sum + rows.length, 0);
  console.log(`Backup OK: ${file} (${rowCount} rows)`);

  // Xoa backup cu, giu KEEP ban gan nhat
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-")).sort();
  while (files.length > KEEP) {
    fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
  return rowCount;
}

if (require.main === module) {
  main().catch((err) => { console.error("Backup LOI:", err.message); process.exit(1); });
}
module.exports = { runBackup: main };
