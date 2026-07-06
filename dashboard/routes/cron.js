const express = require("express");
const db = require("../db/client");
const { postText, postPhoto, getPostInsights } = require("../lib/facebook");

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
      const fbResult = post.image_path
        ? await postPhoto({ message: post.body, imageUrl: post.image_path })
        : await postText({ message: post.body });
      const fbPostId = fbResult.id || fbResult.post_id;
      await db.updatePost(post.id, { fb_post_id: fbPostId, posted_at: now });
      await db.updatePostStatus(post.id, "posted", { note: `Da dang len Facebook, id: ${fbPostId}`, actor: "system" });
      results.push({ id: post.id, status: "posted", fbPostId });
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
      await db.updatePostMetrics(post.id, insights);
      results.push({ id: post.id, ...insights });
    } catch (err) {
      results.push({ id: post.id, error: err.message });
    }
  }

  res.json({ processed: results.length, results });
});

module.exports = router;
