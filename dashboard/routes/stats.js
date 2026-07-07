const express = require("express");
const db = require("../db/client");
const { getContentInsights } = require("../lib/post-insights");

const router = express.Router();

function scorePost(p) {
  const likes = Number(p.fb_likes) || 0;
  const comments = Number(p.fb_comments) || 0;
  const shares = Number(p.fb_shares) || 0;
  // fb_reach = null nghia la chua bao gio do duoc (Meta da go metric reach cap bai
  // viet khoi Graph API) — phai giu null de UI hien "khong co du lieu", khong hien "0"
  const reach = p.fb_reach === null || p.fb_reach === undefined ? null : Number(p.fb_reach);
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    platform: p.platform,
    pillar: p.pillar,
    posted_at: p.posted_at || p.created_at,
    fb_post_id: p.fb_post_id,
    likes,
    comments,
    shares,
    reach,
    total_engagement: likes + comments + shares,
    metrics_updated_at: p.metrics_updated_at,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const posted = await db.listPostedPosts();
    const withScore = posted.map(scorePost).sort((a, b) => b.total_engagement - a.total_engagement);

    const summary = withScore.reduce(
      (acc, p) => {
        acc.likes += p.likes;
        acc.comments += p.comments;
        acc.shares += p.shares;
        if (p.reach !== null) {
          acc.reach = (acc.reach || 0) + p.reach;
          acc.hasReach = true;
        }
        return acc;
      },
      { likes: 0, comments: 0, shares: 0, reach: null, hasReach: false }
    );
    if (!summary.hasReach) summary.reach = null;
    delete summary.hasReach;

    res.json({ posts: withScore, summary, count: withScore.length });
  } catch (err) {
    next(err);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    res.json(await getContentInsights());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
