const express = require("express");
const fs = require("fs");
const path = require("path");
const { proposeWeeklyTopics, getTopicKeywords, setTopicKeywords } = require("../lib/telegram/topic-flow");
const { sendMessage } = require("../lib/telegram/telegram-api");

const OWNER_CHAT_ID = 8481163556;
const router = express.Router();
const FB_BOT_DIR = path.join(__dirname, "..", "..", "facebook-bot");
const GROUPS_FILE = path.join(FB_BOT_DIR, "groups.json");

function readGroupsConfig() {
  if (!fs.existsSync(GROUPS_FILE)) {
    return { maxPerRun: 5, delaySecondsMin: 45, delaySecondsMax: 90, groups: [] };
  }
  return JSON.parse(fs.readFileSync(GROUPS_FILE, "utf-8"));
}

router.get("/groups", (req, res) => {
  const config = readGroupsConfig();
  const loggedIn = fs.existsSync(path.join(FB_BOT_DIR, ".browser-profile"));
  res.json({ ...config, fbLoggedIn: loggedIn });
});

router.put("/groups", (req, res) => {
  const { groups, maxPerRun, autoShareAfterPost, shareDelayMinutes } = req.body;
  const config = readGroupsConfig();
  if (Array.isArray(groups)) {
    config.groups = groups
      .map((g) => String(g).trim())
      .filter((g) => /^https:\/\/(www\.)?facebook\.com\/groups\//.test(g));
  }
  if (maxPerRun) config.maxPerRun = Math.min(Math.max(parseInt(maxPerRun, 10) || 5, 1), 10);
  if (autoShareAfterPost !== undefined) config.autoShareAfterPost = autoShareAfterPost === true;
  if (shareDelayMinutes) config.shareDelayMinutes = Math.min(Math.max(parseInt(shareDelayMinutes, 10) || 20, 5), 120);
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(config, null, 2), "utf-8");
  res.json({ ok: true, saved: config.groups.length });
});

router.get("/share-log", (req, res) => {
  const resultFile = path.join(FB_BOT_DIR, "logs", "last-share-result.json");
  let lastResult = null;
  if (fs.existsSync(resultFile)) {
    lastResult = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
  }
  const cronLogFile = path.join(__dirname, "..", "logs", "cron-out.log");
  let cronTail = [];
  if (fs.existsSync(cronLogFile)) {
    const lines = fs.readFileSync(cronLogFile, "utf-8").trim().split("\n");
    cronTail = lines.slice(-20);
  }
  res.json({ lastResult, cronTail });
});

// ===== Tu khoa dinh huong y tuong =====
router.get("/topic-keywords", async (req, res) => {
  try {
    res.json({ keywords: await getTopicKeywords() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/topic-keywords", async (req, res) => {
  try {
    const keywords = (req.body.keywords || [])
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, 20);
    await setTopicKeywords(keywords);
    res.json({ ok: true, saved: keywords.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Ho so thuong hieu cua Phong =====
const { fetchChannelData } = require("../lib/reference-channel");
const { getBrandProfileMeta, setBrandProfile } = require("../lib/brand-profile");
const { completeOnce } = require("../lib/telegram/draft");

router.get("/brand-profile", async (req, res) => {
  try {
    res.json(await getBrandProfileMeta());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/brand-profile", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Ho so trong" });
    const meta = await getBrandProfileMeta();
    await setBrandProfile(text.trim(), meta.sourceUrl);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dan link kenh CUA PHONG -> AI doc video, tu rut ra ho so thuong hieu
router.post("/brand-profile/analyze", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/youtube\.com|youtu\.be/.test(url)) {
      return res.status(400).json({ error: "Hien moi ho tro link kenh YouTube" });
    }
    const data = await fetchChannelData(url.trim());
    const videoLines = data.videos
      .map((v) => `- "${v.title}" (${v.views} luot xem)${v.description ? `\n  Mo ta: ${v.description.slice(0, 200)}` : ""}`)
      .join("\n");

    const systemPrompt =
      `Ban la chuyen gia phan tich thuong hieu ca nhan. Nhiem vu: doc danh sach video cua kenh YouTube va rut ra HO SO THUONG HIEU cua chu kenh.\n` +
      `Xuat ra dang gach dau dong tieng Viet, ngan gon, moi muc 1-2 dong, gom dung 6 muc:\n` +
      `- Dinh vi: (chu kenh la ai, lam gi, phong cach)\n` +
      `- Chu de chinh: (3-5 chu de kenh hay lam)\n` +
      `- Tu khoa: (5-10 tu khoa xuat hien nhieu)\n` +
      `- San pham/dich vu: (nhung gi kenh dang ban hoac quang ba)\n` +
      `- Giong dieu: (cach dat tieu de, cach noi chuyen)\n` +
      `- Cong thuc tieu de an khach: (rut tu cac video nhieu view nhat)\n` +
      `Khong giai thich gi them ngoai 6 muc tren.`;

    const profileText = await completeOnce(systemPrompt, `Kenh: ${data.channelTitle}\nDanh sach video:\n${videoLines}`);
    await setBrandProfile(profileText, url.trim());
    res.json({ ok: true, channelTitle: data.channelTitle, videoCount: data.videos.length, profile: profileText });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Kenh mau de AI hoc theo =====
const { analyzeChannel, getReferenceChannel } = require("../lib/reference-channel");

router.get("/reference-channel", async (req, res) => {
  try {
    res.json((await getReferenceChannel()) || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/reference-channel", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/youtube\.com|youtu\.be/.test(url)) {
      return res.status(400).json({ error: "Hien moi ho tro link kenh YouTube (youtube.com/...)" });
    }
    const data = await analyzeChannel(url.trim());
    res.json({
      ok: true,
      channelTitle: data.channelTitle,
      videoCount: data.videos.length,
      topVideos: data.videos.slice(0, 5).map((v) => ({ title: v.title, views: v.views })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// De xuat chu de ngay lap tuc (thay vi cho cron thu 2 hang tuan)
router.post("/generate-topics", async (req, res) => {
  try {
    const count = await proposeWeeklyTopics({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
    });
    res.json({ ok: true, proposed: count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
