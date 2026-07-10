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

  const newsList = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n");

  const systemPrompt =
    `Bạn là biên tập viên bản tin AI cho kênh Telegram cộng đồng "KOL AI GO GLOBAL" (chủ đề: dùng AI phát triển kinh doanh, vươn ra toàn cầu). Độc giả là người Việt làm kinh doanh online/affiliate, KHÔNG rành kỹ thuật.\n` +
    `Nhiệm vụ: viết BẢN TIN AI HÔM NAY từ danh sách tin tức được cung cấp.\n` +
    `BẮT BUỘC viết TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ, tự nhiên như người Việt viết.\n` +
    `Định dạng bắt buộc (plain text, không markdown, không dấu **):\n` +
    `- Dòng đầu: "BẢN TIN AI HÔM NAY - ${new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}"\n` +
    `- Chọn 4-5 tin ĐÁNG GIÁ NHẤT với người kinh doanh. Mỗi tin: 1 dòng tiêu đề tiếng Việt hấp dẫn, tiếp theo 1-2 câu giải thích tin này có ý nghĩa gì với việc kiếm tiền/kinh doanh, cuối tin ghi nguồn dạng (Nguồn: TechCrunch).\n` +
    `- TUYỆT ĐỐI KHÔNG chèn bất kỳ link/URL nào vào bản tin.\n` +
    `- Cuối bản tin: 1 câu hỏi thảo luận ngắn cho cộng đồng.\n` +
    `Giọng: dễ hiểu, thực chiến, không dịch word-by-word, không bịa thêm thông tin ngoài tiêu đề.`;

  let digest = await completeOnce(systemPrompt, `Danh sách tin hôm nay:\n${newsList}`);
  // Chan cung: loai moi URL neu AI van lo chen vao (chi bai cua Phong moi duoc co link)
  digest = digest.replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim();
  await sendToChannel(digest);
  await markSent(news);
  return { sent: true, count: news.length };
}

module.exports = { sendDailyDigest, fetchFreshNews };
