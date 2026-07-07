/**
 * Chi con lam 1 viec: theo doi bai moi dang thanh cong de tu dong chia se
 * vao Facebook group qua puppeteer-core (can browser that + session da luu,
 * khong chay duoc tren Vercel serverless nen phai giu local).
 *
 * auto-post / sync-metrics / telegram-review-check / telegram-daily-report /
 * db-backup gio da chay bang Vercel Cron (xem dashboard/vercel.json),
 * khong con phu thuoc may nay nua.
 *
 * Chay bang pm2 (xem ecosystem.config.js).
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env.local") });
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const FB_BOT_DIR = path.join(__dirname, "..", "facebook-bot");
const BASE = process.env.CRON_TARGET_URL || "https://phong-menly-dashboard.vercel.app";
const API_TOKEN = process.env.API_TOKEN;

const STATE_FILE = path.join(__dirname, "group-share-state.json");

function log(msg) {
  console.log(`[${new Date().toLocaleString("vi-VN")}] ${msg}`);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { sharedIds: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// Sau khi bai len Page thanh cong: cho X phut roi tu dong chia se vao cac group (neu da bat trong Cai dat)
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
          headers: { Authorization: `Bearer ${API_TOKEN}` },
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
        log(`Bat dau tu chia se bai #${postId} vao ${Math.min(config.groups.length, config.maxPerRun || 5)} group...`);
      } catch (err) {
        log(`Tu chia se group LOI: ${err.message}`);
      }
    }, delayMs);
  } catch (err) {
    log(`scheduleGroupShare LOI: ${err.message}`);
  }
}

async function watchForNewPosts() {
  try {
    const state = loadState();
    const res = await fetch(`${BASE}/api/posts?status=posted`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    const posts = await res.json();
    const newOnes = (posts || []).filter((p) => !state.sharedIds.includes(p.id));

    for (const post of newOnes) {
      scheduleGroupShare(post.id);
      state.sharedIds.push(post.id);
    }
    if (newOnes.length) {
      if (state.sharedIds.length > 500) state.sharedIds = state.sharedIds.slice(-500);
      saveState(state);
      log(`Phat hien ${newOnes.length} bai moi dang thanh cong`);
    }
  } catch (err) {
    log(`watchForNewPosts LOI: ${err.message}`);
  }
}

log("Cron runner (local, chi con group-share) khoi dong: theo doi bai moi moi 5 phut");
watchForNewPosts();
setInterval(watchForNewPosts, 5 * 60 * 1000);
