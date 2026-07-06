require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const fs = require("fs");
const path = require("path");
const db = require("../db/client");
const { parseFrontmatter, extractTitleFallback } = require("../lib/markdown");

const POSTS_DIR = path.join(__dirname, "..", "..", "posts");

const STATUS_MAP = {
  ready: "ready_for_review",
  draft: "draft",
  published: "posted",
};

async function migrateFile(fileName) {
  const filePath = path.join(POSTS_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const hasFrontmatter = Object.keys(frontmatter).length > 0;
  const slug = fileName.replace(/\.md$/, "");

  const existing = await db.getPostBySlug(slug);
  if (existing) {
    console.log(`Bo qua (da co trong DB): ${fileName}`);
    return;
  }

  let title = frontmatter.title || extractTitleFallback(body) || slug;
  let status = "draft";
  let note = "Import tu file cu, chua ro trang thai that, can Phong xac nhan lai.";

  if (hasFrontmatter && frontmatter.status) {
    status = STATUS_MAP[frontmatter.status] || "draft";
    note = `Import tu file cu, status frontmatter goc la "${frontmatter.status}" -> map thanh "${status}".`;
  }

  const post = await db.createPost({
    slug,
    title,
    body,
    platform: frontmatter.platform || null,
    pillar: frontmatter.pillar || null,
    format: frontmatter.format || null,
    cta_type: frontmatter.cta_type || null,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    status,
    source: "legacy_import",
    actor: "system",
  });

  await db.logHistory({ postId: post.id, eventType: "imported", toStatus: status, note, actor: "system" });
  console.log(`Da import: ${fileName} -> post #${post.id} (${status})`);
}

async function main() {
  await db.ensureSchema();
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Tim thay ${files.length} file .md trong posts/`);
  for (const file of files) {
    await migrateFile(file);
  }
  console.log("Xong.");
}

main().catch((err) => {
  console.error("Loi migrate:", err);
  process.exit(1);
});
