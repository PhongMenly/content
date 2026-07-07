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

const STATUS_LABELS = {
  draft: "ban nhap",
  idea: "y tuong",
  ready_for_review: "cho duyet",
  scheduled: "da len lich",
  posted: "da dang",
  failed: "loi",
  archived: "luu tru",
};

// Khop "duyet", "duyet bai 12", "duyet 12", "duyet #12" — group 1 = so bai (neu co).
// Bat buoc neo ^...$ toan bo chuoi de KHONG khop nham cac cau noi chuyen binh thuong
// bat dau bang "duyet" (vd "duyet roi do, cam on nhe" khong duoc coi la lenh duyet).
const APPROVE_RE = /^(?:duyệt|duyet)(?:\s+(?:bài|bai)?\s*#?(\d+))?$/i;
const EDIT_RE = /^(?:sửa|sua)(?:\s+(?:bài|bai)?\s*#?(\d+))?:?\s*([\s\S]+)$/i;

async function handleReviewReply(text) {
  const state = await loadState();
  const trimmed = text.trim();

  const approveMatch = trimmed.match(APPROVE_RE);
  const editMatch = trimmed.match(EDIT_RE);

  if (approveMatch) {
    const targetId = approveMatch[1] ? Number(approveMatch[1]) : state.lastShownPostId;
    if (!targetId) return null;

    const post = await db.getPost(targetId);
    if (!post) return `Khong tim thay bai #${targetId}.`;
    if (post.status !== "ready_for_review") {
      return `Bai #${post.id} hien khong o trang thai cho duyet (dang la: ${STATUS_LABELS[post.status] || post.status}).`;
    }

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
    const targetId = editMatch[1] ? Number(editMatch[1]) : state.lastShownPostId;
    const newBody = editMatch[2].trim();
    if (!targetId) return null;

    const post = await db.getPost(targetId);
    if (!post) return `Khong tim thay bai #${targetId}.`;
    if (post.status !== "ready_for_review") {
      return `Bai #${post.id} hien khong o trang thai cho duyet (dang la: ${STATUS_LABELS[post.status] || post.status}), khong the sua theo cach nay.`;
    }

    await db.updatePost(post.id, { body: newBody });
    await db.logHistory({
      postId: post.id,
      eventType: "edited",
      note: "Sua qua Telegram",
      actor: "phong",
    });
    return `Da cap nhat noi dung bai #${post.id}. Reply "duyet ${post.id}" khi ung y nhe.`;
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
