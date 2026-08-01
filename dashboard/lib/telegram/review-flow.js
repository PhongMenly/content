const db = require("../../db/client");
const { nextAvailableSlot, formatVN } = require("../schedule");

const STATE_KEY = "bot_review_state";

function defaultState() {
  return { sentPostIds: [], lastShownPostId: null, reportedPostIds: [] };
}

async function loadState() {
  const raw = await db.getKv(STATE_KEY);
  // Khoa an toan: state hong (chuoi, null, sai kieu) -> dung lai mac dinh thay vi
  // vo dau vao undefined.includes() lam chet ca luong viet bai.
  const state = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : defaultState();
  if (!Array.isArray(state.sentPostIds)) state.sentPostIds = [];
  if (!Array.isArray(state.reportedPostIds)) state.reportedPostIds = [];
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
// "duyet ca", "duyet het", "duyet tat ca", "duyet all", "duyet toan bo"
const APPROVE_ALL_RE = /^(?:duyệt|duyet)\s+(?:cả|ca|hết|het|all|tất\s*cả|tat\s*ca|toàn\s*bộ|toan\s*bo)(?:\s+(?:bài|bai))?$/i;
const EDIT_RE = /^(?:sửa|sua)(?:\s+(?:bài|bai)?\s*#?(\d+))?:?\s*([\s\S]+)$/i;

// Duyet 1 bai: xep vao khung gio trong gan nhat roi chuyen sang da len lich
async function approveOne(post) {
  const allScheduled = await db.getScheduledPosts({});
  const taken = allScheduled.filter((p) => p.id !== post.id).map((p) => p.scheduled_time);
  const slot = nextAvailableSlot(taken);
  await db.updatePost(post.id, { scheduled_time: slot });
  return db.updatePostStatus(post.id, "scheduled", {
    note: "Tu dong len lich sau khi duyet (qua Telegram)",
    actor: "phong",
  });
}

function formatSlot(post) {
  return formatVN(post.scheduled_time);
}

async function handleReviewReply(text) {
  const state = await loadState();
  const trimmed = text.trim();

  // Phai kiem tra "duyet ca" TRUOC "duyet <so>" vi ca hai deu bat dau bang "duyet"
  if (APPROVE_ALL_RE.test(trimmed)) {
    const pending = (await db.listPosts({})).filter((p) => p.status === "ready_for_review");
    if (!pending.length) return "Hien khong co bai nao dang cho duyet.";

    const done = [];
    for (const post of pending.sort((a, b) => a.id - b.id)) {
      const updated = await approveOne(post);
      done.push(`#${updated.id} — ${formatSlot(updated)}`);
    }
    return `Da duyet ${done.length} bai va tu len lich:\n` + done.join("\n");
  }

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

    const updated = await approveOne(post);
    return `Da duyet bai #${updated.id}. Tu dong len lich dang luc: ${formatSlot(updated)}`;
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
