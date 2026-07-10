/**
 * Phat song len kenh Telegram cong dong "KOL AI GO GLOBAL".
 * - Bai dang Facebook thanh cong -> tu dua len kenh
 * - Ban tin AI hang ngay cung gui vao day
 * Bot @uyennhiCreator_bot phai la ADMIN cua kenh (co quyen Post Messages).
 */
const { sendMessage, sendPhoto } = require("./telegram-api");

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "-1004352564538";

// sendMessage/sendPhoto tra ve JSON cua Telegram ke ca khi loi — phai tu kiem tra,
// khong duoc bao "thanh cong" khi Telegram tu choi (vd bot chua duoc them vao kenh)
function assertOk(result, action) {
  if (!result || result.ok !== true) {
    const desc = (result && result.description) || "khong ro nguyen nhan";
    throw new Error(`Telegram ${action} vao kenh that bai: ${desc}. Kiem tra bot da la Admin cua kenh chua.`);
  }
}

async function sendToChannel(text) {
  const result = await sendMessage(CHANNEL_ID, text, { disablePreview: true });
  assertOk(result, "gui tin");
  return result;
}

async function broadcastPostToChannel(post) {
  const body = (post.body || "").trim();
  if (!body) return;
  if (post.image_path) {
    // Caption anh Telegram gioi han 1024 ky tu
    const caption = body.length > 1000 ? body.slice(0, 990).trim() + "..." : body;
    assertOk(await sendPhoto(CHANNEL_ID, post.image_path, caption), "gui anh");
  } else {
    await sendToChannel(body);
  }
}

module.exports = { sendToChannel, broadcastPostToChannel, CHANNEL_ID };
