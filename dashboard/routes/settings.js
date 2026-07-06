const express = require("express");
const fs = require("fs");
const path = require("path");

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

module.exports = router;
