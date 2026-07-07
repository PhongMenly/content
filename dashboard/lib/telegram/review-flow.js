const db = require("../../db/client");
const { nextAvailableSlot } = require("../schedule");

const STATE_KEY = "bot_review_state";

function defaultState() {
  return { sentPostIds: [], lastShownPostId: null, reportedPostIds: [] };
}

async function loadState() {
  const state = (await db.getKv(STATE_KEY)) || defaultState();
  if (!state.reportedPostIds) state.reportedPostIds = [];
  return state;
}

async function saveState(state) {
  await db.setKv(STATE_KEY, state);
}

function formatDraftMessage(post) {
  return (
    `BAI MOI CHO DUYET (#${post.id})\n\n` +
    `Tieu de: ${post.title || post.slug}\n` +
    `Pillar: ${post.pillar || "chua gan"}\n\n` +
    `${(post.body || "").slice(0, 900)}\n\n` +
    `---\n` +
    `Reply "duyet" de duyet bai (se tu dong len lich)\n` +
    `Hoac "sua: <noi dung moi>" de chinh sua`
  );
}

// Danh dau 1 bai da gui cho owner + la bai gan nhat dang cho reply "duyet"/"sua"
// Dung khi bai duoc viet full ngay lap tuc (tu topic-flow) thay vi qua checkForNewDrafts.
async function markSentAndShown(postId) {
  const state = await loadState();
  if (!state.sentPostIds.includes(postId)) state.sentPostIds.push(postId);
  state.lastShownPostId = postId;
  await saveState(state);
}

async function checkForNewDrafts({ sendMessage, sendPhoto }) {
  const state = await loadState();
  const drafts = await db.listPosts({ status: "ready_for_review" });
  const newDrafts = drafts.filter((p) => !state.sentPostIds.includes(p.id));

  for (const post of newDrafts) {
    const caption = formatDraftMessage(post);

    if (post.image_path) {
      await sendPhoto(post.image_path, caption);
    } else {
      await sendMessage(caption);
    }

    state.sentPostIds.push(post.id);
    state.lastShownPostId = post.id;
  }

  await saveState(state);
  return newDrafts.length;
}

async function handleReviewReply(text) {
  const state = await loadState();
  if (!state.lastShownPostId) return null;

  const trimmed = text.trim();
  const isApprove = /^duyệt|^duyet$/i.test(trimmed);
  const editMatch = trimmed.match(/^sửa:?\s*(.+)$/is) || trimmed.match(/^sua:?\s*(.+)$/is);

  if (isApprove) {
    const post = await db.getPost(state.lastShownPostId);
    if (!post) return null;

    const allScheduled = await db.getScheduledPosts({});
    const taken = allScheduled.filter((p) => p.id !== post.id).map((p) => p.scheduled_time);
    const slot = nextAvailableSlot(taken);
    await db.updatePost(post.id, { scheduled_time: slot });
    const updated = await db.updatePostStatus(post.id, "scheduled", {
      note: "Tu dong len lich sau khi duyet (qua Telegram)",
      actor: "phong",
    });

    const date = updated.scheduled_time
      ? new Date(updated.scheduled_time * 1000).toLocaleString("vi-VN")
      : "chua ro";
    return `Da duyet bai #${updated.id}. Tu dong len lich dang luc: ${date}`;
  }

  if (editMatch) {
    const newBody = editMatch[1].trim();
    await db.updatePost(state.lastShownPostId, { body: newBody });
    await db.logHistory({
      postId: state.lastShownPostId,
      eventType: "edited",
      note: "Sua qua Telegram",
      actor: "phong",
    });
    return `Da cap nhat noi dung bai #${state.lastShownPostId}. Reply "duyet" khi ung y nhe.`;
  }

  return null;
}

async function checkForPostResults({ sendMessage }) {
  const state = await loadState();
  const [posted, failed] = await Promise.all([
    db.listPosts({ status: "posted" }),
    db.listPosts({ status: "failed" }),
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

  await saveState(state);
  return newResults.length;
}

module.exports = { checkForNewDrafts, handleReviewReply, checkForPostResults, formatDraftMessage, markSentAndShown };
