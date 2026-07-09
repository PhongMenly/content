const express = require("express");
const { proposeWeeklyTopics, getTopicKeywords, setTopicKeywords } = require("../lib/telegram/topic-flow");
const { sendMessage } = require("../lib/telegram/telegram-api");

const OWNER_CHAT_ID = 8481163556;
const router = express.Router();

// ===== Ten Page hien thi tren giao dien (chi de hien thi, khong phai dinh danh dang bai) =====
router.get("/facebook-page-name", (req, res) => {
  res.json({ name: process.env.FB_PAGE_NAME || "Facebook Page" });
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

// ===== Ho so thuong hieu (nhieu persona: Phong Menly, Uyen Linh...) =====
const { fetchChannelData } = require("../lib/reference-channel");
const {
  DEFAULT_KEY,
  listBrandProfiles,
  getBrandProfileMeta,
  setBrandProfile,
  createBrandProfile,
  deleteBrandProfileByKey,
  buildAnalysisSystemPrompt,
  isAnalysisTooEmpty,
} = require("../lib/brand-profile");
const { completeOnce } = require("../lib/telegram/draft");

router.get("/brand-profiles", async (req, res) => {
  try {
    res.json(await listBrandProfiles());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/brand-profiles", async (req, res) => {
  try {
    const { key, name } = req.body;
    if (!key || !key.trim()) return res.status(400).json({ error: "Thieu key ho so (vd: uyen_linh)" });
    if (!name || !name.trim()) return res.status(400).json({ error: "Thieu ten ho so hien thi" });
    const profile = await createBrandProfile(key.trim(), name.trim());
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/brand-profiles/:key", async (req, res) => {
  try {
    const deleted = await deleteBrandProfileByKey(req.params.key);
    if (!deleted) return res.status(404).json({ error: "Khong tim thay ho so" });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/brand-profile", async (req, res) => {
  try {
    res.json(await getBrandProfileMeta(req.query.key || DEFAULT_KEY));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/brand-profile", async (req, res) => {
  try {
    const { text, key } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Ho so trong" });
    const profileKey = key || DEFAULT_KEY;
    const meta = await getBrandProfileMeta(profileKey);
    await setBrandProfile(profileKey, text.trim(), meta.source_url, meta.name);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dan 1 link BAT KY (kenh YouTube hoac bat ky trang web nao) -> AI doc va rut ra ho so thuong hieu.
// Link YouTube dung duong rieng (RSS co so lieu luot xem, chinh xac hon).
// Link khac: doc tho HTML server tra ve — trang can dang nhap/render bang JS (FB ca nhan, TikTok...) se doc duoc rat it.
router.post("/brand-profile/analyze", async (req, res) => {
  try {
    const { url, key } = req.body;
    const profileKey = key || DEFAULT_KEY;
    if (!url || !url.trim()) return res.status(400).json({ error: "Thieu link" });
    const trimmedUrl = url.trim();
    const isYoutube = /youtube\.com|youtu\.be/.test(trimmedUrl);

    let sourceLabel, contentBlock, itemCount, sourceType;

    if (isYoutube) {
      const data = await fetchChannelData(trimmedUrl);
      contentBlock = data.videos
        .map((v) => `- "${v.title}" (${v.views} luot xem)${v.description ? `\n  Mo ta: ${v.description.slice(0, 200)}` : ""}`)
        .join("\n");
      sourceLabel = `Kenh YouTube: ${data.channelTitle}`;
      itemCount = data.videos.length;
      sourceType = "video";
    } else {
      const { fetchGenericPageText } = require("../lib/generic-page");
      const page = await fetchGenericPageText(trimmedUrl);
      contentBlock =
        `Tieu de trang: ${page.title}\n` +
        (page.metaDesc ? `Mo ta: ${page.metaDesc}\n` : "") +
        `Noi dung trang (trich):\n${page.text}`;
      sourceLabel = `Trang web: ${page.title || trimmedUrl}`;
      itemCount = 1;
      sourceType = "trang";
    }

    const profileText = await completeOnce(buildAnalysisSystemPrompt(), `${sourceLabel}\n\n${contentBlock}`);

    if (isAnalysisTooEmpty(profileText)) {
      return res.status(422).json({
        error: "Trang nay khong doc duoc noi dung that (co the can dang nhap hoac render bang JavaScript). Ho so thuong hieu cu van duoc giu nguyen, khong bi ghi de.",
        profile: profileText,
        tooEmpty: true,
      });
    }

    await setBrandProfile(profileKey, profileText, trimmedUrl);
    res.json({ ok: true, channelTitle: sourceLabel, videoCount: itemCount, sourceType, profile: profileText });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dan TRUC TIEP noi dung tho (bat ky nguon nao — Facebook ca nhan, tin nhan, ghi chu...)
// -> luon doc duoc 100% vi khong phu thuoc fetch/JS-render nhu link.
router.post("/brand-profile/analyze-text", async (req, res) => {
  try {
    const { text, key } = req.body;
    const profileKey = key || DEFAULT_KEY;
    if (!text || !text.trim()) return res.status(400).json({ error: "Chua dan noi dung nao" });
    const trimmedText = text.trim();

    // AI de "bia" ra 11 muc nghe hop ly du input rat ngan (khong bao gio tu nhan
    // "chua du du lieu" neu chi thieu it) — phai chan tu truoc bang do dai toi thieu,
    // khong the chi dua vao isAnalysisTooEmpty() sau khi da goi AI.
    const MIN_LENGTH = 400;
    if (trimmedText.length < MIN_LENGTH) {
      return res.status(400).json({
        error: `Noi dung hoi ngan (${trimmedText.length} ky tu, can toi thieu ${MIN_LENGTH}). Dan them vai bai/doan van nua de AI rut ho so chinh xac hon, tranh doan mo.`,
      });
    }

    const profileText = await completeOnce(buildAnalysisSystemPrompt(), `Noi dung do Phong tu dan vao:\n\n${trimmedText.slice(0, 8000)}`);

    if (isAnalysisTooEmpty(profileText)) {
      return res.status(422).json({
        error: "Noi dung dan vao qua it hoac khong ro rang de rut ra ho so. Ho so thuong hieu cu van duoc giu nguyen.",
        profile: profileText,
        tooEmpty: true,
      });
    }

    await setBrandProfile(profileKey, profileText, "pasted-text");
    res.json({ ok: true, profile: profileText });
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
