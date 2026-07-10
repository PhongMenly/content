/**
 * Phat song len kenh Telegram cong dong "KOL AI GO GLOBAL".
 * - Bai dang Facebook thanh cong -> tu dua len kenh
 * - Ban tin AI hang ngay cung gui vao day
 * Bot @uyennhiCreator_bot phai la ADMIN cua kenh (co quyen Post Messages).
 */
const { sendMessage, sendPhoto } = require("./telegram-api");

const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "-1004352564538";

async function sendToChannel(text) {
  return sendMessage(CHANNEL_ID, text);
}

async function broadcastPostToChannel(post) {
  const body = (post.body || "").trim();
  if (!body) return;
  if (post.image_path) {
    // Caption anh Telegram gioi han 1024 ky tu
    const caption = body.length > 1000 ? body.slice(0, 990).trim() + "..." : body;
    await sendPhoto(CHANNEL_ID, post.image_path, caption);
  } else {
    await sendToChannel(body);
  }
}

module.exports = { sendToChannel, broadcastPostToChannel, CHANNEL_ID };
