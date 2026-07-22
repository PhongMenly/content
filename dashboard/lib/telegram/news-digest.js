/**
 * Ban tin AI hang ngay cho kenh KOL AI GO GLOBAL — dang bao anh:
 * moi tin = 1 anh minh hoa + tieu de tieng Viet + 1-2 cau y nghia kinh doanh.
 * KHONG kem link (chi bai cua Phong moi duoc co link).
 */
const db = require("../../db/client");
const { completeOnce } = require("./draft");
const { sendPhotoToChannel } = require("./channel-broadcast");
const { getSystemNotes, formatNotesBlock } = require("./system-notes");

const SENT_KEY = "ai_news_sent_links";
const DASHBOARD_URL = "https://phong-menly-dashboard.vercel.app";
// Anh du phong tren-thuong-hieu (nen toi + vach vang neon), dung khi khong
// lay duoc anh that tu bai bao — dam bao MOI tin luon co anh dinh kem.
const FALLBACK_IMAGES = [
  `${DASHBOARD_URL}/news-fallback/news-fallback-1.png`,
  `${DASHBOARD_URL}/news-fallback/news-fallback-2.png`,
  `${DASHBOARD_URL}/news-fallback/news-fallback-3.png`,
];

// Uu tien nguon chinh chu (blog chinh thuc cua cac hang AI) truoc, bao cong nghe uy tin sau.
const FEEDS = [
  { name: "OpenAI", url: "https://openai.com/blog/rss.xml" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/" },
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

// Chuan hoa link de so sanh trung (bo query/tracking param, bo dau / cuoi, thuong hoa)
function normalizeLink(url) {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/+$/, "").toLowerCase();
  } catch (e) {
    return String(url).split("?")[0].replace(/\/+$/, "").toLowerCase();
  }
}

// Chuan hoa tieu de thanh tap tu khoa chinh (bo dau, bo tu ngan) de phat hien
// cung 1 su kien duoc nhieu nguon dang lai voi tieu de/link khac nhau.
function titleKeywords(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
  );
}

function isSimilarTitle(a, b) {
  const wa = a instanceof Set ? a : titleKeywords(a);
  const wb = b instanceof Set ? b : titleKeywords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.size, wb.size) >= 0.6;
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
  const sent = (await db.getKv(SENT_KEY)) || { links: [], titles: [] };
  const sentLinks = new Set((sent.links || []).map(normalizeLink));
  const sentTitleSets = (sent.titles || []).map(titleKeywords);
  const fresh = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const items = parseFeed(await res.text()).slice(0, 8);
      for (const item of items) {
        if (sentLinks.has(normalizeLink(item.link))) continue;
        const keywords = titleKeywords(item.title);
        // Bo qua neu trung/tuong tu tin da gui truoc do, hoac trung tin nguon khac trong CHINH lan quet nay
        if (sentTitleSets.some((s) => isSimilarTitle(keywords, s))) continue;
        if (fresh.some((f) => isSimilarTitle(keywords, f._keywords))) continue;
        fresh.push({ ...item, source: feed.name, _keywords: keywords });
      }
    } catch (e) {
      // nguon loi thi bo qua
    }
  }
  return fresh.slice(0, maxItems);
}

// RSS nhieu nguon da bo anh -> vao trang bai viet lay anh dai dien.
// Nhieu lop: og:image (thu tu attribute bat ky, nhay don/kep) -> twitter:image
// -> anh <img> dau tien hop le trong noi dung bai (bo icon/logo/avatar/svg).
async function getArticleImage(item) {
  if (item.image) return item.image;
  try {
    const res = await fetch(item.link, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const metaPatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const re of metaPatterns) {
      const m = html.match(re);
      if (m) return m[1].replace(/&amp;/g, "&");
    }

    // Fallback: quet <img> dau tien co ve la anh noi dung that (bo qua icon/logo/avatar/pixel/svg)
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    for (const m of imgMatches) {
      const src = m[1];
      if (/\.svg(\?|$)/i.test(src)) continue;
      if (/(logo|icon|avatar|sprite|pixel|1x1)/i.test(src)) continue;
      if (!/^https?:\/\//i.test(src)) continue;
      return src.replace(/&amp;/g, "&");
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function markSent(items) {
  const sent = (await db.getKv(SENT_KEY)) || { links: [], titles: [] };
  const links = (sent.links || []).concat(items.map((i) => i.link)).slice(-300);
  const titles = (sent.titles || []).concat(items.map((i) => i.title)).slice(-300);
  await db.setKv(SENT_KEY, { links, titles, updatedAt: new Date().toISOString() });
}

function stripUrls(s) {
  return String(s).replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function sendDailyDigest() {
  const news = await fetchFreshNews(8);
  if (news.length === 0) return { sent: false, reason: "Khong co tin moi" };

  const newsList = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n");
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const notesBlock = formatNotesBlock(await getSystemNotes());

  const systemPrompt =
    `Bạn là biên tập viên bản tin AI cho kênh Telegram cộng đồng "KOL AI GO GLOBAL" (chủ đề: dùng AI phát triển kinh doanh, vươn ra toàn cầu). Độc giả là người Việt làm affiliate marketing, xây doanh nghiệp 1 người, làm AI Influencer — họ cần tin để HÀNH ĐỘNG, không cần tin để biết.\n` +
    `CHỦ ĐỀ ƯU TIÊN khi chọn tin (theo thứ tự): (1) affiliate marketing và kiếm tiền online; (2) xây dựng doanh nghiệp 1 người bằng AI; (3) AI Influencer / người mẫu AI / nhân vật ảo có sức ảnh hưởng; (4) động thái của các công ty: Higgsfield, Topview, Lovable, Anthropic/Claude, Google/Gemini, OpenAI/ChatGPT; (5) gọi vốn và khởi nghiệp AI. Tin không dính chủ đề nào thì chỉ chọn khi thực sự lớn.\n` +
    (notesBlock ? `\n${notesBlock}\nNEU co tin nao trong danh sach lien quan truc tiep den ghi chu hien trang tren, UU TIEN chon tin do truoc tien.\n` : "") +
    `Từ danh sách tin được đánh số, chọn DUY NHẤT 1 TIN QUAN TRỌNG NHẤT theo tiêu chí trên.\n` +
    `Với MỖI tin, phần "insight" phải SÂU nhưng NGẮN GỌN: đúng 2-3 câu súc tích, đi thẳng vào việc người làm affiliate/doanh nghiệp 1 người/AI influencer TẬN DỤNG được gì NGAY (cách làm cụ thể, use-case), kèm cơ hội hoặc rủi ro nếu đáng nói. Không câu mở đầu vòng vo, không lặp lại tiêu đề. CẤM viết chung chung kiểu "giúp tiết kiệm thời gian", "nâng cao hiệu quả". Insight tối đa 300 ký tự.\n` +
    `BẮT BUỘC viết TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ. KHÔNG chèn link/URL. Không markdown.\n` +
    `Trả về DUY NHẤT 1 JSON hợp lệ đúng định dạng:\n` +
    `{"items": [{"index": <số thứ tự tin trong danh sách gốc>, "title": "<tiêu đề tiếng Việt hấp dẫn>", "insight": "<phân tích 3-4 câu theo khung trên>"}], "question": "<1 câu hỏi thảo luận ngắn gắn với chủ đề ưu tiên>"}`;

  const raw = await completeOnce(systemPrompt, `Danh sách tin hôm nay:\n${newsList}`);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Khong parse duoc ban tin tu AI: " + raw.slice(0, 200));
  const digest = JSON.parse(jsonMatch[0]);
  const item = (digest.items || [])[0];
  if (!item) throw new Error("AI khong chon duoc tin nao");
  const src = news[item.index - 1];
  if (!src) throw new Error("Tin AI chon khong khop danh sach");

  // Gom tat ca vao 1 tin nhan duy nhat: tieu de ban tin + tin + nguon + cau hoi
  const caption = stripUrls(
    `BẢN TIN AI HÔM NAY - ${today}\n\n` +
      `${item.title}\n\n${item.insight}\n\n(Nguồn: ${src.source})` +
      (digest.question ? `\n\n${digest.question}` : "")
  ).slice(0, 1020);

  // Luon gui kem anh: neu khong lay duoc anh that tu bai bao, dung anh
  // thuong hieu du phong (khong bao gio gui tin thuan text).
  const realImage = await getArticleImage(src);
  const image = realImage || FALLBACK_IMAGES[Math.floor(Date.now() / 1000) % FALLBACK_IMAGES.length];
  await sendPhotoToChannel(image, caption);

  await markSent([src]);
  return { sent: true, count: 1, title: item.title, hasImage: true, usedFallbackImage: !realImage };
}

module.exports = { sendDailyDigest, fetchFreshNews };
