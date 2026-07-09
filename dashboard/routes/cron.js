const express = require("express");
const db = require("../db/client");
const { getPostInsights } = require("../lib/facebook");
const { sendToMakeForPosting } = require("../lib/make");
const { sendMessage, sendPhoto } = require("../lib/telegram/telegram-api");
const { checkForNewDrafts, checkForPostResults } = require("../lib/telegram/review-flow");
const { generateReport } = require("../lib/telegram/insights");
const { runBackup } = require("../lib/backup");
const { proposeWeeklyTopics } = require("../lib/telegram/topic-flow");

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
    res.json({ draftsSent, resultsSent });
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
    const count = await proposeWeeklyTopics({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
    });
    res.json({ ok: true, proposed: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
