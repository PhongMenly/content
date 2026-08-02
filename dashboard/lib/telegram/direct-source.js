/**
 * LAY TIN THANG TU NGUON CHINH CHU cho kenh cong dong "KOL AI GO GLOBAL".
 *
 * Thay cho cach cu (search tu khoa chung tren X roi loc — ra bai cua nguoi la,
 * video hai, anh Phong che "bai rac"), module nay di THANG vao:
 *   Tang 1a — kenh YouTube chinh chu cua 6 tool (RSS, mien phi, video that cua ho)
 *   Tang 1b — tai khoan X chinh chu cua 6 tool + Lil Miquela (Apify, loc bo reply)
 *   Tang 2  — tin tuc noi VE 4 AI influencer anh Phong duyet (Google News)
 *
 * Giu dung format anh Phong thich: tieu de + insight hanh dong duoc + nguon +
 * link xem demo + link affiliate cua anh.
 */
const db = require("../../db/client");
const { completeOnce } = require("./draft");
const { TOOLS, YOUTUBE_RSS, influencerNewsFeeds, officialXQuery, isReplyTweet, toolByName } = require("./sources");
const { affiliateLinkFor, matchTool } = require("./affiliate-links");

const SEEN_KEY = "direct_source_seen";

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// ===== TANG 1a: kenh YouTube chinh chu cua tung tool =====
async function fetchOfficialYouTube(days = 14) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const out = [];
  for (const tool of TOOLS) {
    if (!tool.youtube) continue;
    try {
      const r = await fetch(YOUTUBE_RSS(tool.youtube));
      if (!r.ok) continue;
      const xml = await r.text();
      for (const block of xml.split("<entry>").slice(1)) {
        const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
        const vid = (block.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/) || [])[1] || "";
        const published = (block.match(/<published>([^<]+)</) || [])[1] || "";
        const desc = decode((block.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || "").slice(0, 400);
        if (!title || !vid) continue;
        if (new Date(published).getTime() < cutoff) continue;
        out.push({
          kind: "youtube",
          tool: tool.name,
          title,
          url: `https://www.youtube.com/watch?v=${vid}`,
          key: `yt:${vid}`,
          published,
          text: desc,
        });
      }
    } catch (e) {
      console.warn(`[direct-source] YouTube ${tool.name} loi:`, e.message);
    }
  }
  return out;
}

// ===== TANG 1b: tai khoan X chinh chu =====
async function fetchOfficialX(days = 14) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const actor = "kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest";
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=150`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitterContent: officialXQuery(), maxItems: 60, since }),
      }
    );
    if (!r.ok) return [];
    const items = await r.json();
    return (Array.isArray(items) ? items : [])
      // Tai khoan chinh chu tra loi khach hang rat nhieu — bo het reply.
      .filter((t) => t && t.id && !isReplyTweet(t))
      .map((t) => {
        const handle = (t.author && (t.author.userName || t.author.screenName)) || "";
        return {
          kind: "x",
          tool: (toolByName(handle) || {}).name || handle,
          title: String(t.text || "").split("\n")[0].slice(0, 120),
          url: t.url || t.twitterUrl || `https://x.com/${handle}/status/${t.id}`,
          key: `x:${t.id}`,
          published: t.createdAt || "",
          text: String(t.text || "").slice(0, 600),
          likes: t.likeCount || 0,
        };
      });
  } catch (e) {
    console.warn("[direct-source] X chinh chu loi:", e.message);
    return [];
  }
}

// ===== TANG 2: tin tuc noi VE cac AI influencer =====
async function fetchInfluencerNews() {
  const out = [];
  for (const feed of influencerNewsFeeds()) {
    try {
      const r = await fetch(feed.url);
      if (!r.ok) continue;
      const xml = await r.text();
      for (const block of xml.split("<item>").slice(1, 5)) {
        const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
        const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
        const pub = (block.match(/<pubDate>([^<]+)</) || [])[1] || "";
        if (!title || !link) continue;
        out.push({
          kind: "influencer",
          tool: feed.name,
          title,
          url: link.trim(),
          key: `news:${link.trim().slice(-60)}`,
          published: pub,
          text: title,
        });
      }
    } catch (e) {
      console.warn(`[direct-source] Tin ${feed.name} loi:`, e.message);
    }
  }
  return out;
}

// Viet bai theo dung format anh Phong thich: insight hanh dong duoc + cau hoi
// thao luan. Link (nguon/demo/affiliate) duoc gan SAU, khong de AI tu bia.
async function writePost(item) {
  const system =
    `Bạn là biên tập viên kênh Telegram cộng đồng "KOL AI GO GLOBAL". Độc giả là người Việt làm affiliate, ` +
    `xây doanh nghiệp một người, làm AI Influencer — họ đọc để HÀNH ĐỘNG, không phải để biết.\n` +
    `Viết một bài ngắn về nội dung dưới đây (nguồn: ${item.tool}):\n` +
    `- Câu đầu: nói thẳng chuyện gì vừa xảy ra, cụ thể, không vòng vo.\n` +
    `- Sau đó 2-3 câu: người làm nghề TẬN DỤNG được gì NGAY (cách làm cụ thể, use-case kiếm tiền).\n` +
    `- Câu cuối: một câu hỏi thảo luận ngắn.\n` +
    `- TIẾNG VIỆT CÓ DẤU đầy đủ. Không markdown, không dấu sao. KHÔNG chèn link/URL.\n` +
    `- CẤM viết chung chung kiểu "giúp tiết kiệm thời gian", "nâng cao hiệu quả". Không bịa số liệu.\n` +
    `- Tối đa 700 ký tự.`;
  const out = await completeOnce(system, `Tiêu đề: ${item.title}\n\nNội dung: ${item.text || "(không có mô tả)"}`);
  return out.replace(/https?:\/\/\S+/g, "").trim();
}

// Ghep bai hoan chinh: noi dung + nguon + link xem + link affiliate cua anh Phong.
function buildCaption(body, item) {
  const tool = matchTool(`${item.tool} ${item.title}`) || null;
  let out = `${body}\n\n(Nguồn: ${item.tool})`;
  if (item.kind === "youtube") out += `\n\nXem trực tiếp: ${item.url}`;
  else out += `\n\nNguồn gốc: ${item.url}`;
  const aff = tool ? tool.url : affiliateLinkFor(`${item.tool} ${item.title}`);
  if (aff) out += `\n\nDùng thử tại: ${aff}`;
  return out;
}

// Gom ca 3 tang, bo cai da gui, tra ve danh sach ung vien da sap xep.
async function gatherCandidates({ days = 14, includeX = true } = {}) {
  const seen = new Set((await db.getKv(SEEN_KEY)) || []);
  const [yt, x, news] = await Promise.all([
    fetchOfficialYouTube(days),
    includeX ? fetchOfficialX(days) : Promise.resolve([]),
    fetchInfluencerNews(),
  ]);
  // Uu tien YouTube chinh chu (co video that cua hang) > X chinh chu > tin influencer.
  const rank = { youtube: 0, x: 1, influencer: 2 };
  return [...yt, ...x, ...news]
    .filter((i) => !seen.has(i.key))
    .sort((a, b) => (rank[a.kind] - rank[b.kind]) || (new Date(b.published) - new Date(a.published)));
}

// De xuat N bai tu nguon chinh chu -> gui anh Phong duyet ("dang 1", "dang 1,3").
// Dung chung hang doi x_repost_queue de khong phai hoc them cu phap moi.
async function proposeFromSources({ sendMessage, count = 3, days = 14, includeX = true } = {}) {
  const candidates = await gatherCandidates({ days, includeX });
  if (!candidates.length) {
    await sendMessage("Cac kenh chinh chu chua co gi moi trong ky nay.");
    return { proposed: 0 };
  }

  // Trai deu nguon: khong lay 3 bai cung 1 tool (Higgsfield dang mot minh ap dao).
  const picked = [];
  const usedTools = new Set();
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (usedTools.has(c.tool)) continue;
    usedTools.add(c.tool);
    picked.push(c);
  }
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (!picked.includes(c)) picked.push(c);
  }

  const queue = [];
  for (const item of picked) {
    const body = await writePost(item);
    queue.push({
      id: item.key,
      caption: buildCaption(body, item),
      link: item.url,
      source: item.tool,
      kind: item.kind,
      score: null,
      video: null,
    });
  }

  const seen = (await db.getKv(SEEN_KEY)) || [];
  await db.setKv(SEEN_KEY, [...seen, ...picked.map((p) => p.key)].slice(-400));
  await db.setKv("x_repost_queue", queue);
  await db.setKv("x_repost_pending", null);

  const label = { youtube: "YouTube chinh chu", x: "X chinh chu", influencer: "Tin AI influencer" };
  await sendMessage(`NHI LAY ${queue.length} BAI TU NGUON CHINH CHU — anh xem roi chon:`);
  for (let i = 0; i < queue.length; i++) {
    await sendMessage(`===== BAI ${i + 1}/${queue.length} — ${label[queue[i].kind]} (${queue[i].source}) =====\n\n${queue[i].caption}`);
  }
  await sendMessage('Reply "dang 1" hoac "dang 1,3" de dang len kenh. "bo" neu khong dang bai nao.');
  return { proposed: queue.length };
}

module.exports = {
  SEEN_KEY,
  proposeFromSources,
  fetchOfficialYouTube,
  fetchOfficialX,
  fetchInfluencerNews,
  gatherCandidates,
  writePost,
  buildCaption,
};
