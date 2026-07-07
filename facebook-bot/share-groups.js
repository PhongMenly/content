/**
 * Chia se bai viet len cac Facebook Group da tham gia.
 * Facebook da khoa API dang group tu 2024, nen script nay dieu khien
 * trinh duyet Edge that (puppeteer-core) — thao tac giong het nguoi dung.
 *
 * Cach dung:
 *   1) Dang nhap 1 lan:   node share-groups.js --setup
 *      (Edge mo ra -> dang nhap Facebook -> dong trinh duyet)
 *   2) Chia se:           node share-groups.js --message-file bai.txt
 *      Tuy chon:          --groups groups.json   --show (hien trinh duyet de theo doi)
 *
 * An toan: gioi han maxPerRun group moi lan, nghi ngau nhien 45-90s giua cac group.
 */

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const PROFILE_DIR = path.join(__dirname, ".browser-profile");
const LOG_DIR = path.join(__dirname, "logs");

function findEdge() {
  // Windows + macOS: tim Edge truoc, khong co thi dung Chrome
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Khong tim thay Microsoft Edge hoac Google Chrome tren may");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { setup: false, show: false, groupsFile: path.join(__dirname, "groups.json"), messageFile: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--setup") out.setup = true;
    else if (args[i] === "--show") out.show = true;
    else if (args[i] === "--groups") out.groupsFile = args[++i];
    else if (args[i] === "--message-file") out.messageFile = args[++i];
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

async function launch(show) {
  return puppeteer.launch({
    executablePath: findEdge(),
    headless: show ? false : "new",
    userDataDir: PROFILE_DIR,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled", "--lang=vi-VN"],
  });
}

// Tim nut/textbox theo nhieu mau chu (FB doi giao dien lien tuc)
const COMPOSER_TRIGGERS = ["Bạn viết gì đi", "Bạn đang nghĩ gì", "Viết gì đó", "Write something", "What's on your mind"];
const POST_BUTTON_LABELS = ["Đăng", "Post"];

async function clickComposer(page) {
  const handle = await page.evaluateHandle((triggers) => {
    const nodes = Array.from(document.querySelectorAll('div[role="button"], span'));
    return nodes.find((n) => triggers.some((t) => (n.textContent || "").trim().startsWith(t))) || null;
  }, COMPOSER_TRIGGERS);
  const el = handle.asElement();
  if (!el) throw new Error("Khong tim thay o soan bai trong group");
  await el.click();
}

async function findDialogTextbox(page) {
  await page.waitForSelector('div[role="dialog"] div[role="textbox"]', { timeout: 20000 });
  return page.$('div[role="dialog"] div[role="textbox"]');
}

async function clickPostButton(page) {
  const handle = await page.evaluateHandle((labels) => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return null;
    const buttons = Array.from(dialog.querySelectorAll('div[role="button"], [aria-label]'));
    return (
      buttons.find((b) => labels.includes((b.getAttribute("aria-label") || "").trim()) && b.getAttribute("aria-disabled") !== "true") ||
      buttons.find((b) => labels.includes((b.textContent || "").trim()))
    );
  }, POST_BUTTON_LABELS);
  const el = handle.asElement();
  if (!el) throw new Error("Khong tim thay nut Dang");
  await el.click();
}

async function shareToGroup(page, groupUrl, message) {
  await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(randomBetween(3000, 6000));

  await clickComposer(page);
  const textbox = await findDialogTextbox(page);
  await textbox.click();
  await sleep(1000);

  // Go tung dong de giu xuong dong nhu nguoi that
  const lines = message.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]) await page.keyboard.type(lines[i], { delay: randomBetween(8, 25) });
    if (i < lines.length - 1) await page.keyboard.down("Shift"), await page.keyboard.press("Enter"), await page.keyboard.up("Shift");
  }
  await sleep(randomBetween(2000, 4000));

  await clickPostButton(page);
  await sleep(randomBetween(5000, 8000));
}

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  if (opts.setup) {
    console.log("Mo Edge de dang nhap Facebook. Dang nhap xong thi DONG trinh duyet.");
    const browser = await launch(true);
    const page = await browser.newPage();
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    browser.on("disconnected", () => {
      console.log("Da luu phien dang nhap vao .browser-profile. Xong!");
      process.exit(0);
    });
    return;
  }

  if (!opts.messageFile) {
    console.error('Thieu --message-file. Vi du: node share-groups.js --message-file bai.txt');
    process.exit(1);
  }

  const message = fs.readFileSync(opts.messageFile, "utf-8").trim();
  const config = JSON.parse(fs.readFileSync(opts.groupsFile, "utf-8"));
  const groups = (config.groups || []).slice(0, config.maxPerRun || 5);
  if (groups.length === 0) {
    console.error("groups.json chua co group nao. Dan link group vao mang \"groups\".");
    process.exit(1);
  }

  const browser = await launch(opts.show);
  const page = await browser.newPage();
  const results = [];

  for (let i = 0; i < groups.length; i += 1) {
    const url = groups[i];
    try {
      console.log(`[${i + 1}/${groups.length}] Dang chia se vao: ${url}`);
      await shareToGroup(page, url, message);
      results.push({ url, ok: true });
      console.log("  -> OK");
    } catch (err) {
      results.push({ url, ok: false, error: err.message });
      const shot = path.join(LOG_DIR, `share-fail-${Date.now()}.png`);
      try { await page.screenshot({ path: shot, fullPage: false }); } catch (e) {}
      console.log(`  -> LOI: ${err.message} (screenshot: ${shot})`);
    }
    if (i < groups.length - 1) {
      const wait = randomBetween((config.delaySecondsMin || 45) * 1000, (config.delaySecondsMax || 90) * 1000);
      console.log(`  Nghi ${Math.round(wait / 1000)}s truoc group tiep theo...`);
      await sleep(wait);
    }
  }

  await browser.close();
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nKet qua: ${okCount}/${results.length} group thanh cong`);
  fs.writeFileSync(path.join(LOG_DIR, "last-share-result.json"), JSON.stringify(results, null, 2));
  process.exit(okCount === results.length ? 0 : 2);
}

main().catch((err) => {
  console.error("Loi:", err.message);
  process.exit(1);
});
