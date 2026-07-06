const express = require("express");
const { refreshTopviewCredit, getLatestCredits } = require("../lib/credits");

const router = express.Router();

router.get("/latest", async (req, res, next) => {
  try {
    res.json(await getLatestCredits());
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const result = await refreshTopviewCredit();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
