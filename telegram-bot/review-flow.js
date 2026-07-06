const fs = require("fs");
const path = require("path");
const { listPostsByStatus, patchPost } = require("./dashboard-client");

const STATE_FILE = path.join(__dirname, "review-state.json");

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { sentPostIds: [], lastShownPostId: null, reportedPostIds: [] };
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  if (!state.reportedPostIds) state.reportedPostIds = [];
  return state;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function statusLabel(status) {
  const labels = {
    draft: "Draft",
    ready_for_review: "Cho duyet",
    approved: "Da duyet",
    scheduled: "Da len lich",
    posted: "Da dang",
    failed: "Loi",
  };
  return labels[status] || status;
}

async function checkForNewDrafts({ sendMessage, sendPhoto }) {
  const state = loadState();
  const drafts = await listPostsByStatus("ready_for_review");
  const newDrafts = drafts.filter((p) => !state.sentPostIds.includes(p.id));

  for (const post of newDrafts) {
    const caption =
      `BAI MOI CHO DUYET (#${post.id})\n\n` +
      `Tieu de: ${post.title || post.slug}\n` +
      `Pillar: ${post.pillar || "chua gan"}\n\n` +
      `${(post.body || "").slice(0, 900)}\n\n` +
      `---\n` +
      `Reply "duyet" de duyet bai (se tu dong len lich)\n` +
      `Hoac "sua: <noi dung moi>" de chinh sua`;

    if (post.image_path) {
      await sendPhoto(post.image_path, caption);
    } else {
      await sendMessage(caption);
    }

    state.sentPostIds.push(post.id);
    state.lastShownPostId = post.id;
  }

  saveState(state);
  return newDrafts.length;
}

async function handleReviewReply(text) {
  const state = loadState();
  if (!state.lastShownPostId) return null;

  const trimmed = text.trim();
  const isApprove = /^duyệt|^duyet$/i.test(trimmed);
  const editMatch = trimmed.match(/^sửa:?\s*(.+)$/is) || trimmed.match(/^sua:?\s*(.+)$/is);

  if (isApprove) {
    const updated = await patchPost(state.lastShownPostId, { status: "approved" });
    const date = updated.scheduled_time
      ? new Date(updated.scheduled_time * 1000).toLocaleString("vi-VN")
      : "chua ro";
    return `Da duyet bai #${updated.id}. Tu dong len lich dang luc: ${date}`;
  }

  if (editMatch) {
    const newBody = editMatch[1].trim();
    await patchPost(state.lastShownPostId, { body: newBody, note: "Sua qua Telegram" });
    return `Da cap nhat noi dung bai #${state.lastShownPostId}. Reply "duyet" khi ung y nhe.`;
  }

  return null;
}

async function checkForPostResults({ sendMessage }) {
  const state = loadState();
  const [posted, failed] = await Promise.all([
    listPostsByStatus("posted"),
    listPostsByStatus("failed"),
  ]);

  const newResults = [...posted, ...failed].filter((p) => !state.reportedPostIds.includes(p.id));

  for (const post of newResults) {
    if (post.status === "posted") {
      await sendMessage(
        `DA DANG THANH CONG (#${post.id})\n\n` +
        `Tieu de: ${post.title || post.slug}\n` +
        `Facebook post id: ${post.fb_post_id}\n` +
        `Xem lich su chi tiet tren dashboard.`
      );
    } else {
      await sendMessage(
        `DANG BAI THAT BAI (#${post.id})\n\n` +
        `Tieu de: ${post.title || post.slug}\n` +
        `Vao dashboard xem chi tiet loi va thu lai.`
      );
    }
    state.reportedPostIds.push(post.id);
  }

  saveState(state);
  return newResults.length;
}

module.exports = { checkForNewDrafts, handleReviewReply, checkForPostResults };
