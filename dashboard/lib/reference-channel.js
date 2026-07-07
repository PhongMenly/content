/**
 * Phan tich kenh YouTube mau: lay danh sach video moi nhat + luot xem
 * qua RSS cong khai cua YouTube (khong can API key).
 * Ket qua luu vao bot_kv de bo nao de xuat chu de hoc theo.
 */
const db = require("../db/client");

const KV_KEY = "reference_channel";

// Chap nhan: link channel /channel/UC..., /@handle, /c/ten, /user/ten
async function resolveChannelId(url) {
  const direct = String(url).match(/channel\/(UC[\w-]{20,})/);
  if (direct) return direct[1];

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) throw new Error(`Khong mo duoc link kenh (HTTP ${res.status})`);
  const html = await res.text();
  const m =
    html.match(/"channelId":"(UC[\w-]{20,})"/) ||
    html.match(/channel_id=(UC[\w-]{20,})/) ||
    html.match(/"externalId":"(UC[\w-]{20,})"/);
  if (!m) throw new Error("Khong tim thay channel ID trong trang. Kiem tra lai link kenh.");
  return m[1];
}

function parseRssEntries(xml) {
  const entries = [];
  const blocks = xml.split("<entry>").slice(1);
  for (const block of blocks) {
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
    const videoId = (block.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/) || [])[1] || "";
    const published = (block.match(/<published>([^<]+)<\/published>/) || [])[1] || "";
    const views = parseInt((block.match(/<media:statistics views="(\d+)"/) || [])[1] || "0", 10);
    if (title && videoId) {
      entries.push({ title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"), videoId, published, views });
    }
  }
  return entries;
}

async function analyzeChannel(url) {
  const channelId = await resolveChannelId(url);
  const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!rssRes.ok) throw new Error(`Khong doc duoc RSS kenh (HTTP ${rssRes.status})`);
  const xml = await rssRes.text();

  const channelTitle = (xml.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
  const videos = parseRssEntries(xml).sort((a, b) => b.views - a.views);
  if (videos.length === 0) throw new Error("Kenh khong co video cong khai nao trong RSS.");

  const data = {
    url,
    channelId,
    channelTitle,
    videos,
    analyzedAt: new Date().toISOString(),
  };
  await db.setKv(KV_KEY, data);
  return data;
}

async function getReferenceChannel() {
  return db.getKv(KV_KEY);
}

async function clearReferenceChannel() {
  await db.setKv(KV_KEY, null);
}

// Khoi context ngan gon de nhoi vao prompt de xuat chu de
function buildReferenceBlock(data) {
  if (!data || !data.videos || data.videos.length === 0) return "";
  const top = data.videos.slice(0, 8);
  const lines = top.map((v) => `- "${v.title}" (${v.views.toLocaleString("vi-VN")} luot xem)`);
  return (
    `\nKENH MAU PHONG DANG HOC THEO: "${data.channelTitle}"\n` +
    `Cac video hieu qua nhat cua kenh (xep theo luot xem):\n${lines.join("\n")}\n` +
    `Hay hoc CHU DE va CACH DAT TIEU DE cua cac video an khach nay, roi de xuat PHIEN BAN NANG CAP mang dinh vi Phong Menly (khong sao chep nguyen van).\n`
  );
}

module.exports = { analyzeChannel, getReferenceChannel, clearReferenceChannel, buildReferenceBlock };
