/**
 * Ban tin AI hang ngay cho kenh KOL AI GO GLOBAL.
 * Quet RSS cac nguon tin AI lon -> loc tin chua gui -> AI tom tat tieng Viet
 * theo giong cong dong (thuc chien, de hieu) -> gui len kenh.
 */
const db = require("../../db/client");
const { completeOnce } = require("./draft");
const { sendToChannel } = require("./channel-broadcast");

const SENT_KEY = "ai_news_sent_links";

const FEEDS = [
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
];

function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .trim();
}

function parseFeed(xml) {
  const items = [];
  // RSS <item> hoac Atom <entry>
  const blocks = xml.split(/<item[\s>]/).slice(1).concat(xml.split(/<entry[\s>]/).slice(1));
  for (const block of blocks) {
    const title = decodeEntities((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
    let link = (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    if (!link) link = decodeEntities((block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || "");
    if (title && link) items.push({ title, link: link.trim() });
  }
  return items;
}

async function fetchFreshNews(maxItems = 6) {
  const sent = (await db.getKv(SENT_KEY)) || { links: [] };
  const sentSet = new Set(sent.links);
  const fresh = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const items = parseFeed(await res.text()).slice(0, 8);
      for (const item of items) {
        if (!sentSet.has(item.link)) fresh.push({ ...item, source: feed.name });
      }
    } catch (e) {
      // nguon loi thi bo qua, dung nguon khac
    }
  }
  return fresh.slice(0, maxItems);
}

async function markSent(items) {
  const sent = (await db.getKv(SENT_KEY)) || { links: [] };
  const links = sent.links.concat(items.map((i) => i.link)).slice(-300);
  await db.setKv(SENT_KEY, { links, updatedAt: new Date().toISOString() });
}

async function sendDailyDigest() {
  const news = await fetchFreshNews(6);
  if (news.length === 0) return { sent: false, reason: "Khong co tin moi" };

  const newsList = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}\n   Link: ${n.link}`).join("\n");

  const systemPrompt =
    `Ban la bien tap vien ban tin AI cho kenh Telegram cong dong "KOL AI GO GLOBAL" (chu de: dung AI phat trien kinh doanh, vuon ra toan cau). Doc gia la nguoi Viet lam kinh doanh online/affiliate, KHONG ranh ky thuat.\n` +
    `Nhiem vu: viet BAN TIN AI HOM NAY tu danh sach tin tuc duoc cung cap.\n` +
    `Dinh dang bat buoc (plain text, khong markdown, khong dau **):\n` +
    `- Dong dau: "BAN TIN AI HOM NAY - [ngay]" (dung ngay ${new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})\n` +
    `- Chon 4-5 tin DANG GIA NHAT voi nguoi kinh doanh. Moi tin: 1 dong tieu de tieng Viet hap dan + 1-2 cau giai thich "tin nay co y nghia gi voi viec kiem tien/kinh doanh cua ban" + dong Link giu nguyen.\n` +
    `- Cuoi ban tin: 1 cau hoi hoac goi y thao luan ngan cho cong dong.\n` +
    `Giong: de hieu, thuc chien, khong dich word-by-word, khong bia them thong tin ngoai tieu de.`;

  const digest = await completeOnce(systemPrompt, `Danh sach tin hom nay:\n${newsList}`);
  await sendToChannel(digest);
  await markSent(news);
  return { sent: true, count: news.length };
}

module.exports = { sendDailyDigest, fetchFreshNews };
