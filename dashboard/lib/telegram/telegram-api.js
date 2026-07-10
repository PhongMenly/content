const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text, options = {}) {
  const params = new URLSearchParams({ chat_id: chatId, text });
  if (options.disablePreview) params.set("disable_web_page_preview", "true");
  const res = await fetch(`${TELEGRAM_URL}/sendMessage?${params}`);
  return res.json();
}

async function deleteMessage(chatId, messageId) {
  const params = new URLSearchParams({ chat_id: chatId, message_id: messageId });
  const res = await fetch(`${TELEGRAM_URL}/deleteMessage?${params}`);
  return res.json();
}

async function sendPhoto(chatId, photoUrl, caption) {
  const res = await fetch(`${TELEGRAM_URL}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.slice(0, 1024) }),
  });
  return res.json();
}

async function sendTyping(chatId) {
  const params = new URLSearchParams({ chat_id: chatId, action: "typing" });
  await fetch(`${TELEGRAM_URL}/sendChatAction?${params}`);
}

async function setWebhook(url, secretToken) {
  const res = await fetch(`${TELEGRAM_URL}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: secretToken, allowed_updates: ["message"] }),
  });
  return res.json();
}

async function getWebhookInfo() {
  const res = await fetch(`${TELEGRAM_URL}/getWebhookInfo`);
  return res.json();
}

module.exports = { sendMessage, sendPhoto, sendTyping, setWebhook, getWebhookInfo, deleteMessage };
