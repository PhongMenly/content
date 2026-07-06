/**
 * Backup toan bo du lieu Neon ra Vercel Blob (backups/backup-YYYY-MM-DD.json).
 * Giu 14 ban gan nhat, xoa ban cu hon.
 * Chay tay: node scripts/backup-db.js
 * Chay tu dong: GET /api/cron/db-backup (Vercel Cron, hang ngay 2h sang gio VN)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { runBackup } = require("../lib/backup");

if (require.main === module) {
  runBackup()
    .then(({ url, rowCount }) => console.log(`Backup OK: ${url} (${rowCount} rows)`))
    .catch((err) => { console.error("Backup LOI:", err.message); process.exit(1); });
}

module.exports = { runBackup };
