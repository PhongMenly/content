const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

async function ensureSchema() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
  }
}

function now() {
  return Math.floor(Date.now() / 1000);
}

// Cache danh sach bai trong 15s de tranh moi click cho 1s query len Neon cloud
let postsCache = { rows: null, at: 0 };
const POSTS_CACHE_MS = 15000;

function invalidatePostsCache() {
  postsCache = { rows: null, at: 0 };
}

async function listPosts({ status } = {}) {
  const fresh = postsCache.rows && Date.now() - postsCache.at < POSTS_CACHE_MS;
  if (!fresh) {
    const rows = await sql.query("SELECT * FROM posts ORDER BY updated_at DESC");
    postsCache = { rows, at: Date.now() };
  }
  const rows = postsCache.rows;
  return status ? rows.filter((r) => r.status === status) : rows;
}

async function getPost(id) {
  const rows = await sql.query("SELECT * FROM posts WHERE id = $1", [id]);
  return rows[0] || null;
}

async function getPostBySlug(slug) {
  const rows = await sql.query("SELECT * FROM posts WHERE slug = $1", [slug]);
  return rows[0] || null;
}

async function createPost(data) {
  const ts = now();
  const rows = await sql.query(
    `INSERT INTO posts
      (slug, title, body, platform, pillar, format, cta_type, tags, status, image_path, source, created_at, updated_at, angle, brand_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      data.slug,
      data.title || null,
      data.body || "",
      data.platform || null,
      data.pillar || null,
      data.format || null,
      data.cta_type || null,
      JSON.stringify(data.tags || []),
      data.status || "draft",
      data.image_path || null,
      data.source || "dashboard",
      ts,
      ts,
      data.angle || null,
      data.brand_key || null,
    ]
  );
  const post = rows[0];
  await logHistory({ postId: post.id, eventType: "created", toStatus: post.status, actor: data.actor || "phong" });
  invalidatePostsCache();
  return post;
}

async function updatePost(id, fields) {
  const current = await getPost(id);
  if (!current) throw new Error(`Post ${id} not found`);

  const allowed = [
    "title", "body", "platform", "pillar", "format", "cta_type", "tags",
    "image_path", "fb_post_id", "scheduled_time", "posted_at", "sent_to_make_at",
    "fb_likes", "fb_comments", "fb_shares", "fb_reach", "metrics_updated_at", "angle", "brand_key",
  ];
  const sets = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i}`);
      values.push(key === "tags" ? JSON.stringify(fields[key]) : fields[key]);
      i += 1;
    }
  }
  if (sets.length === 0) return current;

  sets.push(`updated_at = $${i}`);
  values.push(now());
  i += 1;
  values.push(id);

  const rows = await sql.query(`UPDATE posts SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, values);
  invalidatePostsCache();
  return rows[0];
}

async function updatePostStatus(id, newStatus, { note, actor = "phong" } = {}) {
  const current = await getPost(id);
  if (!current) throw new Error(`Post ${id} not found`);

  const rows = await sql.query(
    "UPDATE posts SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *",
    [newStatus, now(), id]
  );
  await logHistory({
    postId: id,
    eventType: "status_changed",
    fromStatus: current.status,
    toStatus: newStatus,
    note,
    actor,
  });
  invalidatePostsCache();
  return rows[0];
}

async function logHistory({ postId, eventType, fromStatus, toStatus, note, actor = "phong" }) {
  await sql.query(
    `INSERT INTO post_history (post_id, event_type, from_status, to_status, note, actor, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [postId, eventType, fromStatus || null, toStatus || null, note || null, actor, now()]
  );
}

async function getHistoryForPost(postId) {
  return sql.query("SELECT * FROM post_history WHERE post_id = $1 ORDER BY created_at DESC", [postId]);
}

async function getRecentHistory(limit = 25) {
  return sql.query(
    `SELECT h.*, p.title FROM post_history h
     LEFT JOIN posts p ON p.id = h.post_id
     ORDER BY h.created_at DESC LIMIT $1`,
    [limit]
  );
}

async function updatePostMetrics(id, { likes, comments, shares, reach }) {
  const rows = await sql.query(
    `UPDATE posts SET fb_likes = $1, fb_comments = $2, fb_shares = $3, fb_reach = $4, metrics_updated_at = $5
     WHERE id = $6 RETURNING *`,
    [likes || 0, comments || 0, shares || 0, reach ?? null, now(), id]
  );
  invalidatePostsCache();
  return rows[0];
}

async function listPostedPosts() {
  return sql.query(
    "SELECT * FROM posts WHERE status = 'posted' ORDER BY COALESCE(posted_at, created_at) DESC"
  );
}

async function getScheduledPosts({ from, to } = {}) {
  if (from && to) {
    return sql.query(
      "SELECT * FROM posts WHERE scheduled_time BETWEEN $1 AND $2 ORDER BY scheduled_time ASC",
      [from, to]
    );
  }
  return sql.query("SELECT * FROM posts WHERE scheduled_time IS NOT NULL ORDER BY scheduled_time ASC");
}

async function saveCreditSnapshot({ provider, balance, rawResponse }) {
  await sql.query(
    "INSERT INTO credit_snapshots (provider, balance, raw_response, fetched_at) VALUES ($1, $2, $3, $4)",
    [provider, balance, rawResponse || null, now()]
  );
}

async function getLatestCreditSnapshot(provider) {
  const rows = await sql.query(
    "SELECT * FROM credit_snapshots WHERE provider = $1 ORDER BY fetched_at DESC LIMIT 1",
    [provider]
  );
  return rows[0] || null;
}

async function addLibraryImage({ fileName, folder, url }) {
  const rows = await sql.query(
    "INSERT INTO image_library (file_name, folder, url, uploaded_at) VALUES ($1, $2, $3, $4) RETURNING *",
    [fileName, folder || null, url, now()]
  );
  return rows[0];
}

async function listLibraryImages() {
  return sql.query("SELECT * FROM image_library ORDER BY uploaded_at DESC");
}

async function removeLibraryImage(id) {
  const rows = await sql.query("DELETE FROM image_library WHERE id = $1 RETURNING *", [id]);
  return rows[0] || null;
}

async function getKv(key, defaultValue = null) {
  const rows = await sql.query("SELECT value FROM bot_kv WHERE key = $1", [key]);
  return rows[0] ? rows[0].value : defaultValue;
}

async function setKv(key, value) {
  await sql.query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, JSON.stringify(value), now()]
  );
}

async function listBrandProfiles() {
  return sql.query("SELECT * FROM brand_profiles ORDER BY name ASC");
}

async function getBrandProfileByKey(key) {
  const rows = await sql.query("SELECT * FROM brand_profiles WHERE key = $1", [key]);
  return rows[0] || null;
}

async function upsertBrandProfile({ key, name, text, sourceUrl }) {
  const rows = await sql.query(
    `INSERT INTO brand_profiles (key, name, text, source_url, updated_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET name = $2, text = $3, source_url = $4, updated_at = $5
     RETURNING *`,
    [key, name, text, sourceUrl || null, now()]
  );
  return rows[0];
}

async function deleteBrandProfile(key) {
  const rows = await sql.query("DELETE FROM brand_profiles WHERE key = $1 RETURNING *", [key]);
  return rows[0] || null;
}

async function deletePost(id) {
  await sql.query("DELETE FROM post_history WHERE post_id = $1", [id]);
  const rows = await sql.query("DELETE FROM posts WHERE id = $1 RETURNING *", [id]);
  invalidatePostsCache();
  return rows[0] || null;
}

module.exports = {
  ensureSchema,
  addLibraryImage,
  listLibraryImages,
  removeLibraryImage,
  getKv,
  setKv,
  listBrandProfiles,
  getBrandProfileByKey,
  upsertBrandProfile,
  deleteBrandProfile,
  listPosts,
  listPostedPosts,
  getPost,
  getPostBySlug,
  createPost,
  deletePost,
  updatePost,
  updatePostMetrics,
  updatePostStatus,
  logHistory,
  getHistoryForPost,
  getRecentHistory,
  getScheduledPosts,
  saveCreditSnapshot,
  getLatestCreditSnapshot,
};
