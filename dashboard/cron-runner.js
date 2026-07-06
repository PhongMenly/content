/**
 * Bo hen gio noi bo — thay cho Vercel Cron (dang rong).
 * - Moi 5 phut: goi /api/cron/auto-post de dang cac bai den gio
 * - Moi 60 phut: goi /api/cron/sync-metrics de cap nhat like/comment/share
 * Chay bang pm2 (xem ecosystem.config.js).
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env.local") });

const BASE = process.env.CRON_TARGET_URL || "http://localhost:4000";
const SECRET = process.env.CRON_SECRET;

async function call(pathname) {
  try {
    const res = await fetch(`${BASE}${pathname}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[${new Date().toLocaleString("vi-VN")}] ${pathname} -> ${res.status} | processed: ${data.processed ?? "?"}`);
    if (data.results && data.results.length > 0) {
      console.log("  " + JSON.stringify(data.results));
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleString("vi-VN")}] ${pathname} LOI: ${err.message}`);
  }
}

console.log("Cron runner khoi dong. auto-post moi 5 phut, sync-metrics moi 60 phut.");
call("/api/cron/auto-post");

setInterval(() => call("/api/cron/auto-post"), 5 * 60 * 1000);
setInterval(() => call("/api/cron/sync-metrics"), 60 * 60 * 1000);
