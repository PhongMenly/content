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
const { sendPhotoToChannel, sendLinkPreviewToChannel } = require("./channel-broadcast");
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

// TAP TRUNG DUNG 6 CONG CU anh Phong lam affiliate (theo yeu cau). Moi feed bam
// sat 1 ten cu the. Cua so 30 ngay vi tin ve tung tool khong ra moi ngay.
// KHONG lay tin ong lon chung chung. Chi them AI Influencer vi hop dinh vi
// nhan vat (Uyen Linh chinh la mot AI influencer).
const FEEDS = [
  { name: "Higgsfield", url: GN('"Higgsfield" when:30d') },
  { name: "Topview", url: GN('"Topview" OR "Topview.ai" when:30d') },
  { name: "HeyGen", url: GN('"HeyGen" when:30d') },
  { name: "Jogg AI", url: GN('"Jogg AI" OR "JoggAI" when:30d') },
  { name: "Base44", url: GN('"Base44" when:30d') },
  { name: "ElevenLabs", url: GN('"ElevenLabs" when:30d') },
  { name: "AI Influencer", url: GN('"AI influencer" OR "virtual influencer" when:21d') },
];

// Link affiliate lay tu nguon chung (affiliate-links.js) = dung link that anh
// Phong cung cap, khong hardcode rieng o day de tranh lech (truoc day link
// Lovable o day bi sai). Tin nhac toi tool nao -> dinh kem link tuong ung.
const { affiliateLinkFor, matchTool } = require("./affiliate-links");

// Lay video MOI NHAT tren kenh YouTube chinh thuc cua 1 tool (qua RSS, khong can
// API key). Dung de gan video demo that vao ban tin thay cho anh tinh.
async function getToolLatestVideo(channelId) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!res.ok) return null;
  const xml = await res.text();
  const first = xml.split("<entry>")[1] || "";
  const id = (first.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
  const title = decodeEntities((first.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
  if (!id) return null;
  return { id, title, url: `https://www.youtube.com/watch?v=${id}` };
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

// Chan anh RAC: logo Google News (lh3.googleusercontent), favicon, logo, icon,
// svg, pixel... -> tra ve true de bo qua, dung anh thuong hieu du phong thay the.
// Day la ly do truoc day ban tin bi dinh logo Google News: link Google News la
// link chuyen huong, vao trang GN thi og:image chinh la logo GN.
function isBadImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return true;
  return (
    /news\.google\.com/i.test(url) ||
    /lh[0-9]\.googleusercontent\.com/i.test(url) || // logo Google News
    /gstatic\.com/i.test(url) ||
    /\.svg(\?|$)/i.test(url) ||
    /(favicon|sprite|1x1|pixel|placeholder|default-|logo[-_.]|[-_/]logo|[-_/]icon)/i.test(url)
  );
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
  if (item.image && !isBadImage(item.image)) return item.image;
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
      if (m && !isBadImage(m[1].replace(/&amp;/g, "&"))) return m[1].replace(/&amp;/g, "&");
    }

    // Fallback: quet <img> dau tien co ve la anh noi dung that (bo qua icon/logo/avatar/pixel/svg)
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    for (const m of imgMatches) {
      const src = m[1].replace(/&amp;/g, "&");
      if (/(avatar)/i.test(src)) continue;
      if (isBadImage(src)) continue;
      return src;
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
  const allNews = await fetchFreshNews(12);
  // YEU CAU anh Phong: ban tin len nhom Telegram PHAI co video demo moi gui.
  // -> chi giu tin ve tool co kenh YouTube (Higgsfield, Topview, HeyGen, Jogg,
  // Base44, ElevenLabs). Tin khong gan duoc video thi bo, khong gui.
  const news = allNews.filter((n) => {
    const t = matchTool(`${n.title} ${n.source}`);
    return t && t.youtube;
  });
  if (news.length === 0) return { sent: false, reason: "Khong co tin ve tool nao co video hom nay -> khong gui" };

  const newsList = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n");
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const notesBlock = formatNotesBlock(await getSystemNotes());

  const systemPrompt =
    `Bạn là biên tập viên bản tin AI cho kênh Telegram cộng đồng "KOL AI GO GLOBAL" (chủ đề: dùng AI phát triển kinh doanh, vươn ra toàn cầu). Độc giả là người Việt làm affiliate marketing, xây doanh nghiệp 1 người, làm AI Influencer — họ cần tin để HÀNH ĐỘNG, không cần tin để biết.\n` +
    `TRỌNG TÂM TUYỆT ĐỐI — chỉ chọn tin về 6 công cụ này (đây là tool anh Phong làm affiliate):\n` +
    `Higgsfield, Topview, HeyGen, Jogg AI, Base44, ElevenLabs.\n` +
    `Ưu tiên tin: ra mắt tính năng mới, đổi giá/gói, cuộc thi, thương vụ, cách dùng thực chiến để làm video/voice/app kiếm tiền.\n` +
    `Ngoài ra chấp nhận thêm tin về AI Influencer / người mẫu AI / nhân vật ảo có sức ảnh hưởng quốc tế (vì hợp định vị nhân vật).\n` +
    `TUYỆT ĐỐI BỎ QUA tin của các ông lớn (OpenAI, Google/Gemini, Anthropic, Microsoft, Meta...) và mọi tool KHÔNG nằm trong 6 tên trên — trừ khi tin đó nói TRỰC TIẾP về 1 trong 6 tool. Phân biệt: "Higgs boson" (vật lý) KHÔNG phải Higgsfield; "top view" (góc nhìn) KHÔNG phải Topview.\n` +
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
  // affiliate/video them SAU buoc do thi moi con lai.
  const baseCaption = stripUrls(
    `BẢN TIN AI HÔM NAY - ${today}\n\n` +
      `${item.title}\n\n${item.insight}\n\n(Nguồn: ${src.source})` +
      (digest.question ? `\n\n${digest.question}` : "")
  ).slice(0, 900);

  const matchText = `${item.title} ${item.insight} ${src.title} ${src.source}`;
  const tool = matchTool(matchText);
  const affiliate = tool ? tool.url : null;

  // BAT BUOC CO VIDEO: lay video demo moi nhat cua tool. Da loc chi con tin ve
  // tool co kenh YouTube nen den day gan nhu luon co video; neu RSS loi tam thoi
  // -> KHONG gui, khong danh dau (de lan sau thu lai), dung yeu cau "phai co
  // video moi duyet".
  const toolVideo = tool && tool.youtube ? await getToolLatestVideo(tool.youtube).catch(() => null) : null;
  if (!toolVideo) {
    return { sent: false, reason: `Khong lay duoc video demo cho ${tool ? tool.name : "tool"} (RSS loi tam thoi) -> khong gui` };
  }

  // Link video dat TRUOC link affiliate de Telegram preview dung video (xem ngay trong bai)
  let msg = `${baseCaption}\n\n▶ Xem ${tool.name} hoạt động: ${toolVideo.url}`;
  if (affiliate) msg += `\n\nDùng thử tại: ${affiliate}`;
  await sendLinkPreviewToChannel(msg.slice(0, 4000));

  await markSent([src]);
  return { sent: true, count: 1, title: item.title, affiliate, media: "video", video: toolVideo.url, videoTitle: toolVideo.title };
}

module.exports = { sendDailyDigest, fetchFreshNews, affiliateLinkFor };
