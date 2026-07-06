const express = require("express");
const db = require("../db/client");

const router = express.Router();
const MIN_DATA_THRESHOLD = 5;

function scorePost(p) {
  const likes = Number(p.fb_likes) || 0;
  const comments = Number(p.fb_comments) || 0;
  const shares = Number(p.fb_shares) || 0;
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    body: p.body,
    platform: p.platform,
    pillar: p.pillar,
    posted_at: p.posted_at || p.created_at,
    fb_post_id: p.fb_post_id,
    likes,
    comments,
    shares,
    total_engagement: likes + comments + shares,
    metrics_updated_at: p.metrics_updated_at,
  };
}

function groupByAvg(posts, key) {
  const groups = {};
  for (const p of posts) {
    const label = p[key] || "(chua gan)";
    if (!groups[label]) groups[label] = { label, count: 0, total_engagement: 0 };
    groups[label].count += 1;
    groups[label].total_engagement += p.total_engagement;
  }
  return Object.values(groups)
    .map((g) => ({ ...g, avg_engagement: Math.round((g.total_engagement / g.count) * 10) / 10 }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);
}

function bodySnippet(body) {
  return (body || "").replace(/^#.*\n+/, "").slice(0, 300);
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
        return acc;
      },
      { likes: 0, comments: 0, shares: 0 }
    );

    res.json({ posts: withScore, summary, count: withScore.length });
  } catch (err) {
    next(err);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    const posted = await db.listPostedPosts();
    const withScore = posted.map(scorePost).sort((a, b) => b.total_engagement - a.total_engagement);
    const postedCount = withScore.length;

    if (postedCount < MIN_DATA_THRESHOLD) {
      return res.json({
        enough_data: false,
        posted_count: postedCount,
        min_required: MIN_DATA_THRESHOLD,
        message: `Chua du du lieu de rut ra insight (${postedCount}/${MIN_DATA_THRESHOLD} bai da dang co so lieu).`,
      });
    }

    const totalEngagement = withScore.reduce((sum, p) => sum + p.total_engagement, 0);
    const baselineAvg = Math.round((totalEngagement / postedCount) * 10) / 10;

    const toExample = (p) => ({
      title: p.title || p.slug,
      pillar: p.pillar,
      platform: p.platform,
      total_engagement: p.total_engagement,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      body_snippet: bodySnippet(p.body),
    });

    res.json({
      enough_data: true,
      posted_count: postedCount,
      baseline_avg_engagement: baselineAvg,
      by_pillar: groupByAvg(withScore, "pillar"),
      by_platform: groupByAvg(withScore, "platform"),
      top_posts: withScore.slice(0, 3).map(toExample),
      bottom_posts: withScore.slice(-3).reverse().map(toExample),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
