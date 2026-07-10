/**
 * Ban tin AI hang ngay cho kenh KOL AI GO GLOBAL — dang bao anh:
 * moi tin = 1 anh minh hoa + tieu de tieng Viet + 1-2 cau y nghia kinh doanh.
 * KHONG kem link (chi bai cua Phong moi duoc co link).
 */
const db = require("../../db/client");
const { completeOnce } = require("./draft");
const { sendToChannel, sendPhotoToChannel } = require("./channel-broadcast");

const SENT_KEY = "ai_news_sent_links";

const FEEDS = [
  { name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
];

function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .trim();
}

function extractImage(block) {
  const decoded = decodeEntities(block);
  const m =
    decoded.match(/<media:content[^>]+url="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
    decoded.match(/<media:content[^>]+url="(https?:\/\/[^"]+)"/i) ||
    decoded.match(/<enclosure[^>]+url="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
    decoded.match(/<media:thumbnail[^>]+url="(https?:\/\/[^"]+)"/i) ||
    decoded.match(/<img[^>]+src="(https?:\/\/[^"]+)"/i);
  return m ? m[1] : null;
}

function parseFeed(xml) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/).slice(1).concat(xml.split(/<entry[\s>]/).slice(1));
  for (const block of blocks) {
    const title = decodeEntities((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
    let link = (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    if (!link) link = decodeEntities((block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || "");
    const image = extractImage(block);
    if (title && link) items.push({ title, link: link.trim(), image });
  }
  return items;
}

async function fetchFreshNews(maxItems = 8) {
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
      // nguon loi thi bo qua
    }
  }
  return fresh.slice(0, maxItems);
}

async function markSent(items) {
  const sent = (await db.getKv(SENT_KEY)) || { links: [] };
  const links = sent.links.concat(items.map((i) => i.link)).slice(-300);
  await db.setKv(SENT_KEY, { links, updatedAt: new Date().toISOString() });
}

function stripUrls(s) {
  return String(s).replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function sendDailyDigest() {
  const news = await fetchFreshNews(8);
  if (news.length === 0) return { sent: false, reason: "Khong co tin moi" };

  const newsList = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n");
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const systemPrompt =
    `Bạn là biên tập viên bản tin AI cho kênh Telegram cộng đồng "KOL AI GO GLOBAL" (chủ đề: dùng AI phát triển kinh doanh, vươn ra toàn cầu). Độc giả là người Việt làm affiliate marketing, xây doanh nghiệp 1 người, làm AI Influencer — họ cần tin để HÀNH ĐỘNG, không cần tin để biết.\n` +
    `CHỦ ĐỀ ƯU TIÊN khi chọn tin (theo thứ tự): (1) affiliate marketing và kiếm tiền online; (2) xây dựng doanh nghiệp 1 người bằng AI; (3) AI Influencer / người mẫu AI / nhân vật ảo có sức ảnh hưởng; (4) động thái của các công ty: Higgsfield, Topview, Lovable, Anthropic/Claude, Google/Gemini, OpenAI/ChatGPT; (5) gọi vốn và khởi nghiệp AI. Tin không dính chủ đề nào thì chỉ chọn khi thực sự lớn.\n` +
    `Từ danh sách tin được đánh số, chọn 4-5 tin theo tiêu chí trên.\n` +
    `Với MỖI tin, phần "insight" phải SÂU nhưng NGẮN GỌN: đúng 2-3 câu súc tích, đi thẳng vào việc người làm affiliate/doanh nghiệp 1 người/AI influencer TẬN DỤNG được gì NGAY (cách làm cụ thể, use-case), kèm cơ hội hoặc rủi ro nếu đáng nói. Không câu mở đầu vòng vo, không lặp lại tiêu đề. CẤM viết chung chung kiểu "giúp tiết kiệm thời gian", "nâng cao hiệu quả". Insight tối đa 300 ký tự.\n` +
    `BẮT BUỘC viết TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ. KHÔNG chèn link/URL. Không markdown.\n` +
    `Trả về DUY NHẤT 1 JSON hợp lệ đúng định dạng:\n` +
    `{"items": [{"index": <số thứ tự tin trong danh sách gốc>, "title": "<tiêu đề tiếng Việt hấp dẫn>", "insight": "<phân tích 3-4 câu theo khung trên>"}], "question": "<1 câu hỏi thảo luận ngắn gắn với chủ đề ưu tiên>"}`;

  const raw = await completeOnce(systemPrompt, `Danh sách tin hôm nay:\n${newsList}`);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Khong parse duoc ban tin tu AI: " + raw.slice(0, 200));
  const digest = JSON.parse(jsonMatch[0]);
  const items = (digest.items || []).slice(0, 5);
  if (items.length === 0) throw new Error("AI khong chon duoc tin nao");

  // Tieu de ban tin
  await sendToChannel(`BẢN TIN AI HÔM NAY - ${today}`);

  const sentItems = [];
  for (const item of items) {
    const src = news[item.index - 1];
    if (!src) continue;
    const caption = stripUrls(`${item.title}\n\n${item.insight}\n\n(Nguồn: ${src.source})`);
    try {
      if (src.image) {
        await sendPhotoToChannel(src.image, caption);
      } else {
        await sendToChannel(caption);
      }
      sentItems.push(src);
    } catch (e) {
      // anh loi (het han, chan hotlink...) -> gui dang text de khong mat tin
      try {
        await sendToChannel(caption);
        sentItems.push(src);
      } catch (e2) {
        // bo qua tin nay
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (digest.question) {
    await sendToChannel(stripUrls(digest.question));
  }

  await markSent(sentItems);
  return { sent: true, count: sentItems.length };
}

module.exports = { sendDailyDigest, fetchFreshNews };
