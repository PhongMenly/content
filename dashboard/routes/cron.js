const express = require("express");
const db = require("../db/client");
const { getPostInsights } = require("../lib/facebook");
const { sendToMakeForPosting } = require("../lib/make");
const { sendMessage, sendPhoto } = require("../lib/telegram/telegram-api");
const { checkForNewDrafts, checkForPostResults } = require("../lib/telegram/review-flow");
const { generateReport } = require("../lib/telegram/insights");
const { runBackup } = require("../lib/backup");
const { proposeTopics } = require("../lib/telegram/topic-flow");

const OWNER_CHAT_ID = 8481163556;

const router = express.Router();

function checkCronAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (header === `Bearer ${process.env.CRON_SECRET}`) return next();
  return res.status(401).json({ error: "Unauthorized cron request" });
}

router.get("/auto-post", checkCronAuth, async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const due = (await db.getScheduledPosts({})).filter(
    (p) => p.status === "scheduled" && Number(p.scheduled_time) <= now
  );

  const results = [];
  for (const post of due) {
    try {
      // Khoa an toan: den gio dang ma thieu noi dung hoac thieu anh -> KHONG dang
      if (!post.body || !post.body.trim()) {
        await db.updatePostStatus(post.id, "failed", { note: "Chan dang: bai khong co noi dung", actor: "system" });
        results.push({ id: post.id, status: "failed", error: "Bai khong co noi dung" });
        continue;
      }
      if (!post.image_path) {
        await db.updatePostStatus(post.id, "failed", { note: "Chan dang: bai chua co hinh anh", actor: "system" });
        results.push({ id: post.id, status: "failed", error: "Bai chua co hinh anh" });
        continue;
      }
      // Gui sang Make de dang len Facebook. Make khong goi nguoc lai duoc (buoc
      // callback hay bi loi validation ben Make), nhung da xac nhan webhook nay
      // luon dang bai thanh cong that su, nen danh dau "posted" ngay tai day.
      // Khong co fb_post_id that (Make khong tra ve) nen dong bo so lieu/binh luan
      // se khong dung duoc cho cac bai nay.
      await sendToMakeForPosting({ postId: post.id, message: post.body, imageUrl: post.image_path });
      await db.updatePost(post.id, { posted_at: now });
      await db.updatePostStatus(post.id, "posted", { note: "Da gui sang Make va dang len Facebook", actor: "system" });
      results.push({ id: post.id, status: "posted" });

      // Dang Facebook xong -> tu dua bai len kenh Telegram cong dong (loi kenh khong anh huong viec dang)
      try {
        const { broadcastPostToChannel } = require("../lib/telegram/channel-broadcast");
        await broadcastPostToChannel(post);
      } catch (chErr) {
        console.error("[channel-broadcast] Loi:", chErr.message);
      }
    } catch (err) {
      await db.updatePostStatus(post.id, "failed", { note: err.message, actor: "system" });
      results.push({ id: post.id, status: "failed", error: err.message });
    }
  }

  res.json({ processed: results.length, results });
});

router.get("/sync-metrics", checkCronAuth, async (req, res) => {
  const posted = (await db.listPostedPosts()).filter((p) => p.fb_post_id);

  const results = [];
  for (const post of posted) {
    try {
      const insights = await getPostInsights(post.fb_post_id);
      // fb_post_id cu la photo id -> thay bang post id that de lan sau khoi tra cuu
      if (insights.resolvedPostId && insights.resolvedPostId !== post.fb_post_id) {
        await db.updatePost(post.id, { fb_post_id: insights.resolvedPostId });
      }
      await db.updatePostMetrics(post.id, insights);
      results.push({ id: post.id, ...insights });
    } catch (err) {
      results.push({ id: post.id, error: err.message });
    }
  }

  res.json({ processed: results.length, results });
});

router.get("/telegram-review-check", checkCronAuth, async (req, res) => {
  try {
    const draftsSent = await checkForNewDrafts({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
      sendPhoto: (url, caption) => sendPhoto(OWNER_CHAT_ID, url, caption),
    });
    const resultsSent = await checkForPostResults({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
    });

    // May giu kho bai: kho Uyen Linh tut duoi muc toi thieu -> AI de xuat bu ngay
    let pipeline = null;
    try {
      const { ensureTopicPipeline } = require("../lib/telegram/pipeline-guard");
      pipeline = await ensureTopicPipeline({ sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text) });
    } catch (pErr) {
      console.error("[pipeline-guard] Loi:", pErr.message);
    }

    res.json({ draftsSent, resultsSent, pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/telegram-daily-report", checkCronAuth, async (req, res) => {
  try {
    const report = await generateReport();
    await sendMessage(OWNER_CHAT_ID, "BAO CAO INSIGHTS HANG NGAY TU NHI:\n\n" + report);
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bao cao ket qua cuoi ngay ve Telegram
router.get("/daily-summary", checkCronAuth, async (req, res) => {
  try {
    const { buildDailySummary } = require("../lib/telegram/daily-summary");
    await sendMessage(OWNER_CHAT_ID, await buildDailySummary());
    res.json({ ok: true, sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nhi tu hoc cuoi ngay: rut bai hoc tu hoi thoai + hanh dong, nap vao nao cho ngay mai
router.get("/self-learn", checkCronAuth, async (req, res) => {
  try {
    const { runDailySelfLearn } = require("../lib/telegram/self-learn");
    const result = await runDailySelfLearn({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ban tin AI hang ngay cho kenh cong dong
router.get("/ai-news-digest", checkCronAuth, async (req, res) => {
  try {
    const { sendDailyDigest } = require("../lib/telegram/news-digest");
    const result = await sendDailyDigest();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// May canh YouTube: co video moi -> Nhi gioi thieu len kenh Telegram cong dong
// Chay tu dong: quet video moi. Them ?videoId=xxx de gui tay 1 video cu the
// (dung khi muon dang lai video cu len kenh), ?videoId=latest de gui video moi nhat.
router.get("/youtube-check", checkCronAuth, async (req, res) => {
  try {
    const { checkNewVideos, sendVideoById, resetBaseline } = require("../lib/telegram/youtube-watch");
    const { videoId, reset } = req.query;
    // ?reset=1 -> dat lai moc tinh tu bay gio: moi video hien co coi nhu cu
    if (reset) return res.json({ ok: true, reset: true, ...(await resetBaseline()) });
    if (videoId) {
      const result = await sendVideoById(videoId === "latest" ? null : videoId);
      return res.json({ ok: true, manual: true, ...result });
    }
    res.json({ ok: true, ...(await checkNewVideos()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/db-backup", checkCronAuth, async (req, res) => {
  try {
    const result = await runBackup();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/generate-topics", checkCronAuth, async (req, res) => {
  try {
    const brandKey = req.query.brandKey || "phong_menly";
    const count = await proposeTopics({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
      brandKey,
      count: brandKey === "phong_menly" ? 5 : 3,
    });
    res.json({ ok: true, proposed: count, brandKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
