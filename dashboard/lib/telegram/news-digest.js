/**
 * Ban tin AI hang ngay cho kenh KOL AI GO GLOBAL — dang bao anh:
 * DUNG 1 tin quan trong nhat/ngay = 1 anh minh hoa + tieu de tieng Viet + insight
 * kinh doanh ngan gon. Khong co tin nao du quan trong thi KHONG gui.
 *
 * Link: moi link trong phan AI viet deu bi xoa (tranh link rac tu bao). Ngoai le
 * duy nhat la link affiliate cua anh Phong khi tin noi ve Higgsfield / Lovable.
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

// Nguon tin bam sat 5 chu de anh Phong quan tam.
//
// Luu y ve X va LinkedIn: ca hai KHONG con cung cap RSS cong khai (X dong API tu
// 2023, LinkedIn chan doc tu dong). Da thu Nitter va RSSHub — deu chet. Thay vao
// do dung Google News theo tu khoa: no gom tin tu hang tram bao, bao gom ca cac
// su kien dang duoc ban tan tren X/LinkedIn, ma khong ton phi va khong the bi chan.
const GN = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

const FEEDS = [
  // Blog chinh chu — tin goc, dang tin cay nhat
  { name: "OpenAI", url: "https://openai.com/blog/rss.xml" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/" },
  // Theo doi rieng tung chu de trong tam
  { name: "Higgsfield", url: GN("\"Higgsfield\" AI video when:7d") },
  { name: "Lovable", url: GN("\"Lovable\" AI app builder OR vibe coding when:7d") },
  { name: "AI Influencer", url: GN("\"AI influencer\" OR \"virtual influencer\" when:7d") },
  { name: "OpenAI", url: GN("OpenAI when:3d") },
  { name: "Anthropic", url: GN("Anthropic Claude when:3d") },
  // Tin AI lon noi chung — de khong bo lo su kien tam co nganh
  { name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/" },
];

// Tin nhac den cong cu anh Phong lam affiliate -> dinh kem link gioi thieu.
// Khop theo ca tieu de lan phan AI viet, khong phan biet hoa thuong.
const AFFILIATE_LINKS = [
  { match: /higgsfield/i, url: "https://higgsfield.ai/?fpr=twt6ij" },
  { match: /lovable/i, url: "https://lovablelabs.pxf.io/9VyJx3" },
];

function affiliateLinkFor(text) {
  const hit = AFFILIATE_LINKS.find((l) => l.match.test(text || ""));
  return hit ? hit.url : null;
}

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

  // Gom tin theo tung nguon truoc (chay song song cho nhanh)
  const perFeed = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) return { feed, items: [] };
        return { feed, items: parseFeed(await res.text()).slice(0, 8) };
      } catch (e) {
        return { feed, items: [] }; // nguon loi thi bo qua
      }
    })
  );

  // Lay xen ke moi nguon 1 tin roi vong lai. Neu lay tuan tu het nguon nay moi
  // sang nguon khac thi nguon dau (OpenAI) chiem het cho, cac chu de trong tam
  // khac (Higgsfield, Lovable, AI Influencer) khong bao gio duoc AI nhin thay.
  const maxDepth = Math.max(...perFeed.map((f) => f.items.length), 0);
  for (let depth = 0; depth < maxDepth && fresh.length < maxItems; depth += 1) {
    for (const { feed, items } of perFeed) {
      if (fresh.length >= maxItems) break;
      const item = items[depth];
      if (!item) continue;
      if (sentLinks.has(normalizeLink(item.link))) continue;
      const keywords = titleKeywords(item.title);
      // Bo qua neu trung/tuong tu tin da gui truoc do, hoac trung tin nguon khac trong CHINH lan quet nay
      if (sentTitleSets.some((s) => isSimilarTitle(keywords, s))) continue;
      if (fresh.some((f) => isSimilarTitle(keywords, f._keywords))) continue;
      fresh.push({ ...item, source: feed.name, _keywords: keywords });
    }
  }
  return fresh;
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
    `CHỈ chọn tin THỰC SỰ QUAN TRỌNG: ra mắt sản phẩm/tính năng lớn, thay đổi giá hoặc chính sách, gọi vốn lớn, thương vụ mua bán, thay đổi ảnh hưởng trực tiếp tới cách người làm nghề kiếm tiền. TUYỆT ĐỐI BỎ QUA: tin dạng bàn luận chung chung, bài xếp hạng "top 10 công cụ", tin trùng lặp sự kiện cũ, tin không liên quan (ví dụ "Higgs boson" trong vật lý KHÔNG phải Higgsfield).\n` +
    `Nếu hôm nay không có tin nào đủ quan trọng, trả về {"items": []} — thà không gửi còn hơn gửi tin nhạt.\n` +
    `Với MỖI tin, phần "insight" phải SÂU nhưng NGẮN GỌN: đúng 2 câu súc tích, đi thẳng vào việc người làm affiliate/doanh nghiệp 1 người/AI influencer TẬN DỤNG được gì NGAY (cách làm cụ thể, use-case), kèm cơ hội hoặc rủi ro nếu đáng nói. Không câu mở đầu vòng vo, không lặp lại tiêu đề. CẤM viết chung chung kiểu "giúp tiết kiệm thời gian", "nâng cao hiệu quả". Insight tối đa 220 ký tự.\n` +
    `BẮT BUỘC viết TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ. KHÔNG chèn link/URL. Không markdown.\n` +
    `Trả về DUY NHẤT 1 JSON hợp lệ đúng định dạng (mảng items có đúng 1 phần tử, hoặc rỗng nếu không có tin đáng gửi):\n` +
    `{"items": [{"index": <số thứ tự tin trong danh sách gốc>, "title": "<tiêu đề tiếng Việt hấp dẫn>", "insight": "<2 câu theo khung trên>"}], "question": "<1 câu hỏi thảo luận ngắn gắn với chủ đề ưu tiên>"}`;

  const raw = await completeOnce(systemPrompt, `Danh sách tin hôm nay:\n${newsList}`);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Khong parse duoc ban tin tu AI: " + raw.slice(0, 200));
  const digest = JSON.parse(jsonMatch[0]);

  // AI duoc phep tra ve rong khi khong co tin nao du quan trong — khong ep gui
  const item = (digest.items || [])[0];
  if (!item) return { sent: false, reason: "Khong co tin nao du quan trong hom nay" };
  const src = news[item.index - 1];
  if (!src) throw new Error("Tin AI chon khong khop danh sach");

  // stripUrls xoa moi link trong phan AI viet (tranh link rac tu bao). Link
  // affiliate phai them SAU buoc do thi moi con lai.
  let caption = stripUrls(
    `BẢN TIN AI HÔM NAY - ${today}\n\n` +
      `${item.title}\n\n${item.insight}\n\n(Nguồn: ${src.source})` +
      (digest.question ? `\n\n${digest.question}` : "")
  ).slice(0, 900);

  const affiliate = affiliateLinkFor(`${item.title} ${item.insight} ${src.title} ${src.source}`);
  if (affiliate) caption += `\n\nDùng thử tại: ${affiliate}`;

  // Luon gui kem anh: neu khong lay duoc anh that tu bai bao, dung anh
  // thuong hieu du phong (khong bao gio gui tin thuan text).
  const realImage = await getArticleImage(src);
  const image = realImage || FALLBACK_IMAGES[Math.floor(Date.now() / 1000) % FALLBACK_IMAGES.length];
  await sendPhotoToChannel(image, caption);

  await markSent([src]);
  return { sent: true, count: 1, title: item.title, affiliate, hasImage: true, usedFallbackImage: !realImage };
}

module.exports = { sendDailyDigest, fetchFreshNews, affiliateLinkFor };
