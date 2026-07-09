const express = require("express");
const multer = require("multer");
const db = require("../db/client");
const { toUnixTime, nextAvailableSlot } = require("../lib/schedule");
const { uploadImageBuffer } = require("../lib/blob");
const { getPostInsights, getPostComments, createComment, deleteComment } = require("../lib/facebook");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.get("/", async (req, res, next) => {
  try {
    const posts = await db.listPosts({ status: req.query.status });
    const allPosts = req.query.status ? await db.listPosts({}) : posts;

    const postedSorted = allPosts
      .filter((p) => p.status === "posted")
      .sort((a, b) => (a.posted_at || a.created_at) - (b.posted_at || b.created_at));
    const numberMap = new Map(postedSorted.map((p, i) => [p.id, i + 1]));

    const withNumbers = posts.map((p) => ({
      ...p,
      posted_number: numberMap.get(p.id) || null,
    }));
    res.json(withNumbers);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });
    const history = await db.getHistoryForPost(post.id);

    let posted_number = null;
    if (post.status === "posted") {
      const allPosts = await db.listPosts({});
      const postedSorted = allPosts
        .filter((p) => p.status === "posted")
        .sort((a, b) => a.created_at - b.created_at);
      posted_number = postedSorted.findIndex((p) => p.id === post.id) + 1;
    }

    res.json({ ...post, history, posted_number });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, platform, pillar, format, cta_type, tags, body, status, source, image_path, brand_key } = req.body;
    if (!title) return res.status(400).json({ error: "Thieu title" });

    // Agent duoc phep tao bai thang vao trang thai cho duyet
    const allowedStatuses = ["draft", "ready_for_review"];
    const initialStatus = allowedStatuses.includes(status) ? status : "draft";

    // Bai day len Cho duyet BAT BUOC phai co noi dung
    if (initialStatus === "ready_for_review" && (!body || !body.trim())) {
      return res.status(400).json({ error: "Bai chua co noi dung — khong duoc day len Cho duyet" });
    }

    const baseSlug = slugify(title);
    const slug = `${new Date().toISOString().slice(0, 10)}-${baseSlug}`;
    const post = await db.createPost({
      slug,
      title,
      body: body || "",
      platform,
      pillar,
      format,
      cta_type,
      tags,
      status: initialStatus,
      source: source || "dashboard",
      image_path: image_path || null,
      brand_key: brand_key || null,
    });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });

    const { status, scheduled_time, note, ...metaFields } = req.body;

    if (Object.keys(metaFields).length > 0) {
      await db.updatePost(post.id, metaFields);
      if (metaFields.body !== undefined) {
        await db.logHistory({ postId: post.id, eventType: "edited", note: note || "Sua noi dung", actor: "phong" });
      }
    }

    if (scheduled_time !== undefined) {
      const unixTime = toUnixTime(scheduled_time);
      await db.updatePost(post.id, { scheduled_time: unixTime });
      await db.logHistory({ postId: post.id, eventType: "scheduled", note: `Len lich: ${scheduled_time}`, actor: "phong" });
    }

    if (status === "approved") {
      // Chi duyet khi bai da du: noi dung + hinh anh
      const fresh = await db.getPost(post.id);
      if (!fresh.body || !fresh.body.trim()) {
        return res.status(400).json({ error: "Bai chua co noi dung — khong the duyet" });
      }
      if (!fresh.image_path) {
        return res.status(400).json({ error: "Bai chua co hinh anh — them anh truoc khi duyet" });
      }
      const allScheduled = await db.getScheduledPosts({});
      const taken = allScheduled.filter((p) => p.id !== post.id).map((p) => p.scheduled_time);
      const slot = nextAvailableSlot(taken);
      await db.updatePost(post.id, { scheduled_time: slot });
      await db.updatePostStatus(post.id, "scheduled", { note: "Tu dong len lich sau khi duyet", actor: "phong" });
    } else if (status === "cancel_schedule") {
      await db.updatePost(post.id, { scheduled_time: null });
      await db.updatePostStatus(post.id, "approved", { note: "Huy lich, quay ve da duyet", actor: "phong" });
    } else if (status !== undefined) {
      await db.updatePostStatus(post.id, status, { note, actor: "phong" });
    }

    const updated = await db.getPost(post.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== Quan ly binh luan cua bai da dang =====
router.get("/:id/comments", async (req, res) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });
    if (!post.fb_post_id) return res.status(400).json({ error: "Bai chua dang len Facebook" });
    const comments = await getPostComments(post.fb_post_id);
    res.json(comments);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });
    if (!post.fb_post_id) return res.status(400).json({ error: "Bai chua dang len Facebook" });
    const { message, comment_id } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "Chua nhap noi dung binh luan" });
    const target = comment_id || post.fb_post_id;
    const result = await createComment(target, message.trim());
    res.json({ ok: true, id: result.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id/comments/:commentId", async (req, res) => {
  try {
    await deleteComment(req.params.commentId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });
    await db.deletePost(post.id);
    res.json({ ok: true, deleted: post.id });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/image", upload.single("image"), async (req, res, next) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });
    if (!req.file) return res.status(400).json({ error: "Thieu file anh" });

    const url = await uploadImageBuffer(req.file.originalname, req.file.buffer, req.file.mimetype);
    const updated = await db.updatePost(post.id, { image_path: url });
    await db.logHistory({ postId: post.id, eventType: "image_uploaded", note: url, actor: "phong" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/sync-metrics", async (req, res, next) => {
  try {
    const post = await db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: "Khong tim thay bai viet" });
    if (!post.fb_post_id) return res.status(400).json({ error: "Bai viet chua co fb_post_id (chua dang len Facebook)" });

    const insights = await getPostInsights(post.fb_post_id);
    const updated = await db.updatePostMetrics(post.id, insights);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
