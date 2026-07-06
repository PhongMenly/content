const express = require("express");
const db = require("../db/client");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const posts = await db.getScheduledPosts(from && to ? { from: Number(from), to: Number(to) } : {});
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
