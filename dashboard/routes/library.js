const express = require("express");
const db = require("../db/client");
const { deleteImage } = require("../lib/blob");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const images = await db.listLibraryImages();
    res.json(images);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const removed = await db.removeLibraryImage(req.params.id);
    if (!removed) return res.status(404).json({ error: "Khong tim thay anh" });
    try {
      await deleteImage(removed.url);
    } catch (err) {
      // Blob co the da bi xoa truoc do, khong chan viec xoa record trong DB
    }
    res.json(removed);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
