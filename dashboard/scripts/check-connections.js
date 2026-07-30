/**
 * Kiem tra suc khoe tat ca ket noi cua he thong (DB, Facebook, Telegram, Kyma, Make, cron Production).
 * Chay tay: node scripts/check-connections.js
 * Kiem tra ca ban that tren Vercel: node scripts/check-connections.js --prod
 *
 * Doc key tu .env.local. Cac key chi dat tren Vercel (Production) se bao THIEU o local
 * — dung --prod de goi thang cron tren Vercel cho ket qua dung moi truong that.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const PROD_BASE = "https://phong-menly-dashboard.vercel.app";
const out = [];
const ok = (n, m) => out.push(["OK   ", n, m]);
const bad = (n, m) => out.push(["LOI  ", n, m]);
const skip = (n, m) => out.push(["THIEU", n, m]);

async function checkDb() {
  if (!process.env.DATABASE_URL) return skip("Postgres", "thieu DATABASE_URL");
  try {
    const postgres = require("postgres");
    const pg = postgres(process.env.DATABASE_URL, { prepare: false, ssl: "require", max: 1 });
    const s = await pg.unsafe("select status, count(*)::int as n from posts group by status order by n desc");
    await pg.end();
    ok("Postgres", s.map((x) => `${x.status}:${x.n}`).join(", "));
  } catch (e) {
    bad("Postgres", e.message);
  }
}

async function checkFacebook() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) return skip("Facebook Graph", "thieu FB_PAGE_ACCESS_TOKEN/FB_PAGE_ID");
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=name,fan_count&access_token=${token}`);
    const d = await r.json();
    if (d.error) return bad("Facebook Graph", `${d.error.message} (code ${d.error.code})`);
    ok("Facebook Graph", `${d.name} | ${d.fan_count ?? "?"} follower`);
  } catch (e) {
    bad("Facebook Graph", e.message);
  }
}

async function checkMake() {
  const url = process.env.MAKE_FACEBOOK_WEBHOOK_URL;
  if (!url) return skip("Make webhook", "thieu MAKE_FACEBOOK_WEBHOOK_URL");
  try {
    const r = await fetch(url);
    const t = (await r.text()).slice(0, 30);
    r.ok ? ok("Make webhook (duong dang bai)", `HTTP ${r.status} ${t}`) : bad("Make webhook", `HTTP ${r.status} ${t}`);
  } catch (e) {
    bad("Make webhook", e.message);
  }
}

async function checkTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return skip("Telegram Bot", "thieu TELEGRAM_BOT_TOKEN");
  try {
    const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
    if (!me.ok) return bad("Telegram Bot", JSON.stringify(me).slice(0, 120));
    ok("Telegram Bot", `@${me.result.username}`);
    const w = (await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json()).result || {};
    if (!w.url) return bad("Telegram Webhook", "CHUA DAT — bot khong nhan duoc lenh");
    ok("Telegram Webhook", `cho xu ly:${w.pending_update_count} | loi: ${w.last_error_message || "khong"}`);
  } catch (e) {
    bad("Telegram Bot", e.message);
  }
}

async function checkAi() {
  const { chatComplete, currentModel, provider } = require("../lib/ai");
  const name = `Nao AI (${provider()} / ${currentModel()})`;
  try {
    const t = await chatComplete({
      system: "Tra loi dung 2 tu.",
      messages: [{ role: "user", content: "He thong on chua?" }],
      maxTokens: 20,
      temperature: 0,
    });
    ok(name, `tra loi duoc: "${t.slice(0, 40)}"`);
  } catch (e) {
    bad(name, e.message.slice(0, 160));
  }
}

// Cac may tu dong tren Vercel co thuc su dang chay khong (khong can bat may cua Phong)
async function checkCronHeartbeat() {
  if (!process.env.DATABASE_URL) return skip("Nhip tim cron", "thieu DATABASE_URL");
  try {
    const { neon } = require("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`select updated_at from bot_kv where key = 'bot_review_state'`;
    if (!rows.length) return bad("Nhip tim cron", "chua co du lieu");
    const t = Number(rows[0].updated_at);
    const minutes = Math.round((Date.now() - (t > 1e12 ? t : t * 1000)) / 60000);
    minutes <= 20
      ? ok("Nhip tim cron (Vercel)", `may 5 phut vua chay ${minutes} phut truoc`)
      : bad("Nhip tim cron (Vercel)", `im lang ${minutes} phut — cron co the da tat`);
  } catch (e) {
    bad("Nhip tim cron", e.message);
  }
}

// Goi cron that tren Vercel — chi cac cron KHONG gui gi ra kenh cong dong
async function checkProdCrons() {
  const secret = process.env.CRON_SECRET;
  if (!secret) return skip("Cron Production", "thieu CRON_SECRET");
  for (const path of ["/api/cron/auto-post", "/api/cron/sync-metrics", "/api/cron/self-learn"]) {
    try {
      const r = await fetch(PROD_BASE + path, { headers: { Authorization: `Bearer ${secret}` } });
      const t = (await r.text()).slice(0, 180);
      r.ok ? ok(`prod ${path}`, t) : bad(`prod ${path}`, `HTTP ${r.status} ${t}`);
    } catch (e) {
      bad(`prod ${path}`, e.message);
    }
  }
}

(async () => {
  const checks = [checkDb(), checkFacebook(), checkMake(), checkTelegram(), checkAi(), checkCronHeartbeat()];
  if (process.argv.includes("--prod")) checks.push(checkProdCrons());
  await Promise.all(checks);
  for (const [s, n, m] of out) console.log(`[${s}] ${n.padEnd(28)} ${m}`);
})();
