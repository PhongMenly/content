/**
 * Bo hen gio noi bo — thay cho Vercel Cron (dang rong).
 * - Moi 5 phut: goi /api/cron/auto-post de dang cac bai den gio
 *   -> co bai dang / bai loi thi bao ve Telegram
 * - Moi 60 phut: goi /api/cron/sync-metrics de cap nhat like/comment/share
 * - 2h sang hang ngay: backup toan bo DB ra backups/
 * Chay bang pm2 (xem ecosystem.config.js).
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env.local") });
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { runBackup } = require("./scripts/backup-db");

const FB_BOT_DIR = path.join(__dirname, "..", "facebook-bot");

const BASE = process.env.CRON_TARGET_URL || "http://localhost:4000";
const SECRET = process.env.CRON_SECRET;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function log(msg) {
  console.log(`[${new Date().toLocaleString("vi-VN")}] ${msg}`);
}

async function notifyTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
    });
  } catch (err) {
    log(`Telegram LOI: ${err.message}`);
  }
}

async function call(pathname) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const data = await res.json().catch(() => ({}));
  log(`${pathname} -> ${res.status} | processed: ${data.processed ?? "?"}`);
  return data;
}

// Sau khi bai len Page thanh cong: cho X phut roi tu chia se vao cac group (neu da bat trong Cai dat)
function scheduleGroupShare(postId) {
  try {
    const groupsFile = path.join(FB_BOT_DIR, "groups.json");
    if (!fs.existsSync(groupsFile)) return;
    const config = JSON.parse(fs.readFileSync(groupsFile, "utf-8"));
    const ready =
      config.autoShareAfterPost === true &&
      (config.groups || []).length > 0 &&
      fs.existsSync(path.join(FB_BOT_DIR, ".browser-profile"));
    if (!ready) return;

    const delayMs = (config.shareDelayMinutes || 20) * 60 * 1000;
    log(`Bai #${postId}: se tu chia se vao ${config.groups.length} group sau ${config.shareDelayMinutes || 20} phut`);

    setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/posts/${postId}`, {
          headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
        });
        const post = await res.json();
        if (!post || !post.body) return;

        const logsDir = path.join(FB_BOT_DIR, "logs");
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        const messageFile = path.join(logsDir, `share-message-${postId}.txt`);
        fs.writeFileSync(messageFile, post.body, "utf-8");

        const runLog = fs.openSync(path.join(logsDir, `share-run-${postId}-${Date.now()}.log`), "a");
        const child = spawn(process.execPath, ["share-groups.js", "--message-file", messageFile], {
          cwd: FB_BOT_DIR,
          detached: true,
          stdio: ["ignore", runLog, runLog],
        });
        child.unref();
        await notifyTelegram(`Bat dau tu chia se bai #${postId} vao ${Math.min(config.groups.length, config.maxPerRun || 5)} group...`);
      } catch (err) {
        log(`Tu chia se group LOI: ${err.message}`);
      }
    }, delayMs);
  } catch (err) {
    log(`scheduleGroupShare LOI: ${err.message}`);
  }
}

async function autoPost() {
  try {
    const data = await call("/api/cron/auto-post");
    for (const r of data.results || []) {
      if (r.status === "posted") {
        await notifyTelegram(`DA DANG BAI len Facebook\nBai #${r.id} | fb_post_id: ${r.fbPostId}\nKiem tra: https://phong-menly-dashboard.vercel.app/posts/${r.id}`);
        scheduleGroupShare(r.id);
      } else {
        await notifyTelegram(`LOI DANG BAI #${r.id}\n${r.error}\nVao dashboard kiem tra va bam dang lai.`);
      }
    }
  } catch (err) {
    log(`auto-post LOI: ${err.message}`);
  }
}

async function syncMetrics() {
  try {
    await call("/api/cron/sync-metrics");
  } catch (err) {
    log(`sync-metrics LOI: ${err.message}`);
  }
}

let lastBackupDate = "";
async function dailyBackup() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getHours() === 2 && lastBackupDate !== today) {
    lastBackupDate = today;
    try {
      const rows = await runBackup();
      log(`Backup DB xong (${rows} rows)`);
      await notifyTelegram(`Backup du lieu hang ngay OK (${rows} dong).`);
    } catch (err) {
      log(`Backup LOI: ${err.message}`);
      await notifyTelegram(`Backup du lieu LOI: ${err.message}`);
    }
  }
}

console.log("Cron runner khoi dong: auto-post 5 phut | sync-metrics 60 phut | backup 2h sang");
autoPost();

setInterval(autoPost, 5 * 60 * 1000);
setInterval(syncMetrics, 60 * 60 * 1000);
setInterval(dailyBackup, 10 * 60 * 1000);
