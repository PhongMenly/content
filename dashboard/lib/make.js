// Gui bai viet sang Make de tu dang len Facebook Page qua scenario
// "Dashboard -> Facebook Auto Post" (Webhook -> Facebook Pages -> goi nguoc lai
// API cua dashboard de cap nhat fb_post_id + status=posted).
// Dung cach nay thay vi goi thang Graph API vi Meta da han che Business Manager
// cua tai khoan chinh — Make dung ket noi Facebook rieng, khong dinh toi van de do.
async function sendToMakeForPosting({ postId, message, imageUrl }) {
  const webhookUrl = process.env.MAKE_FACEBOOK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("Thieu MAKE_FACEBOOK_WEBHOOK_URL trong .env");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, message, imageUrl }),
  });
  if (!res.ok) throw new Error(`Make webhook tra ve loi: ${res.status}`);
}

module.exports = { sendToMakeForPosting };
