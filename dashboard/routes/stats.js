const express = require("express");
const db = require("../db/client");
const { getContentInsights } = require("../lib/post-insights");

const router = express.Router();

function scorePost(p) {
  const likes = Number(p.fb_likes) || 0;
  const comments = Number(p.fb_comments) || 0;
  const shares = Number(p.fb_shares) || 0;
  const reach = Number(p.fb_reach) || 0;
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
        acc.reach += p.reach;
        return acc;
      },
      { likes: 0, comments: 0, shares: 0, reach: 0 }
    );

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
