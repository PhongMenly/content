/**
 * Dang lai bai X (Twitter) hot ve AI len kenh cong dong.
 *
 * Cach lam (giong cac kenh tin AI khac): X co cua CONG KHAI de nhung tweet
 * (cdn.syndication.twimg.com) -> dua link 1 bai X vao la lay duoc CA chu + video
 * mp4 that, khong can dang nhap. Khau TIM bai hot van do NGUOI lam (X chan lung
 * tin tu dong); khau lay video + viet lai + dang thi Nhi tu lo.
 *
 * Luong: anh Phong dan link X -> Nhi lay video, viet lai theo giong Phong Menly,
 * GUI NHAP cho anh Phong duyet -> anh reply "dang" moi dang len kenh.
 */
const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { completeOnce } = require("./draft");
const { sendVideoToChannel, sendPhotoToChannel, sendLinkPreviewToChannel } = require("./channel-broadcast");

const PENDING_KEY = "x_repost_pending";
const QUEUE_KEY = "x_repost_queue";
const MAX_TG_VIDEO = 20 * 1024 * 1024; // Telegram gui video qua URL gioi han ~20MB

function parseTweetId(url) {
  const m = String(url).match(/(?:x\.com|twitter\.com)\/[^\/\s]+\/status\/(\d+)/i);
  return m ? m[1] : null;
}

function hasXLink(text) {
  return /(?:x\.com|twitter\.com)\/[^\/\s]+\/status\/\d+/i.test(text || "");
}

// Lay noi dung + media 1 bai X qua cua nhung cong khai (khong can dang nhap).
async function fetchTweet(id) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=a&lang=en`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" } });
  if (!r.ok) throw new Error(`Khong doc duoc bai X (HTTP ${r.status})`);
  const j = await r.json();
  const md = (j.mediaDetails || [])[0];

  let video = null;
  let photo = null;
  if (md && md.video_info && Array.isArray(md.video_info.variants)) {
    const mp4s = md.video_info.variants
      .filter((v) => v.content_type === "video/mp4")
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    // Chon ban chat cao nhat ma <= 20MB (gioi han Telegram)
    for (const v of mp4s) {
      try {
        const h = await fetch(v.url, { method: "HEAD" });
        const size = Number(h.headers.get("content-length") || 0);
        if (size > 0 && size <= MAX_TG_VIDEO) { video = v.url; break; }
      } catch (e) { /* thu ban tiep */ }
    }
    if (!video && mp4s.length) video = mp4s[mp4s.length - 1].url; // ban nho nhat, thu van hon khong
  } else if (md && md.type === "photo") {
    photo = md.media_url_https;
  }

  const handle = (j.user && j.user.screen_name) || "";
  return { id, text: j.text || "", video, photo, handle, tweetUrl: `https://x.com/${handle}/status/${id}` };
}

// Nhi viet lai bai X thanh bai ngan cho kenh, theo giong Phong Menly.
async function writeCaption(tweet) {
  const system =
    UYEN_NHI_BRAIN +
    `\n\n===== NHIEM VU: VIET LAI 1 BAI X (Twitter) HOT VE AI CHO KENH TELEGRAM =====\n` +
    `Viet voi tu cach CHINH Phong Menly dang len kenh cong dong cua minh. Yeu cau:\n` +
    `- Tieng Viet co dau day du, giong thuc chien, tu tin, gan gui; xung "minh", goi nguoi doc "anh em"/"ban".\n` +
    `- Cau dau la hook neu dung dieu hay ho/gay to mo.\n` +
    `- Sau do 2-4 gach dau dong ngan: chuyen gi + nguoi lam noi dung/kiem tien voi AI tan dung duoc gi NGAY.\n` +
    `- TUYET DOI khong bia so lieu ngoai bai goc. Khong markdown, khong dung dau *. Toi da 600 ky tu.\n` +
    `- KHONG chen link (link nguon se them sau).`;
  const out = await completeOnce(system, `Bai X goc (tac gia @${tweet.handle}):\n${tweet.text}`);
  return out.trim();
}

// Anh Phong dan link X -> lay video, viet nhap, gui anh Phong duyet.
async function handleXLink(text, { sendMessage, sendVideo, sendPhoto }) {
  const url = (text.match(/https?:\/\/(?:x\.com|twitter\.com)\/[^\s]+/i) || [])[0];
  const id = url && parseTweetId(url);
  if (!id) return null;

  const tweet = await fetchTweet(id);
  if (!tweet.video && !tweet.photo) {
    await sendMessage("Bai X nay khong co video/anh nen khong dang. Chi dang duoc bai co video hoac anh.");
    return true;
  }

  const body = await writeCaption(tweet);
  const caption = `${body}\n\n(Nguon: X @${tweet.handle})\n${tweet.tweetUrl}`;
  await db.setKv(PENDING_KEY, { ...tweet, caption, at: Date.now() });

  await sendMessage("NHAP BAI TU X — duyet dang len kenh cong dong:\n\n" + caption);
  if (tweet.video) await sendVideo(tweet.video, "Video se dang kem (xem thu)");
  else if (tweet.photo) await sendPhoto(tweet.photo, "Anh se dang kem");
  await sendMessage('Reply "dang" de dang len kenh, "sua: ..." de sua loi, "bo" de huy.');
  return true;
}

// Duyet/sua/huy bai X dang cho. Tra ve chuoi ket qua, hoac null neu khong phai
// lenh cho X (de cac luong khac xu ly tiep).
// Bai X treo qua lau -> bo han. Truoc day khong het han: mot bai X treo tu hom
// truoc van chan moi lenh "duyet" cua anh Phong o cac ngay sau.
const PENDING_TTL_MS = 6 * 3600 * 1000;

// "duyet ca", "duyet het", "duyet 12" la lenh cua luong DUYET BAI NHAP, khong phai
// bai X. Truoc day regex cua X bat moi cau bat dau bang "duyet" nen bai X treo
// nuot sach lenh duyet bai -> anh Phong go "duyet ca" ma bai khong he len lich.
// KHONG dung \b voi chu tieng Viet co dau: \b cua JS chi hieu ky tu ASCII, nen
// /\bcả\b/ KHONG khop "duyet ca" (sau chu "a" co dau khong co ranh gioi tu ASCII).
// Dung ranh gioi khoang trang/dau chuoi tuong minh cho chac.
const SCOPE_HINT = /(^|\s)(cả|ca|hết|het|tất|tat|toàn|toan|all)(\s|$)|\d/i;
const X_HINT = /(^|\s)(x|twitter|tweet)(\s|$)/i;

// Yeu cau XEM LAI ban nhap (khong phai lenh dang): "gui lai", "cho xem lai",
// "xem lai di", "gui lai toi xem chu sao lai duyet".
const RESEND_RE = /^(gửi|gui|cho|xem|coi|show)\b[\s\S]*\b(lại|lai|xem|coi|thử|thu)\b/i;

function isXCommand(t, verbRegex) {
  if (!verbRegex.test(t)) return false;
  // Cau co pham vi ("ca"/"het") hoac co so -> chi tinh la lenh cho X khi noi RO X.
  return SCOPE_HINT.test(t) ? X_HINT.test(t) : true;
}

async function handleXApproval(text, { sendMessage }) {
  const pending = await db.getKv(PENDING_KEY);
  const queue = (await db.getKv(QUEUE_KEY)) || [];
  const hasQueue = Array.isArray(queue) && queue.length > 0;
  if (!pending && !hasQueue) return null;
  if (pending) {
    const at = Number(pending.at);
    if (!Number.isFinite(at) || Date.now() - at > PENDING_TTL_MS) {
      await db.setKv(PENDING_KEY, null);
      if (!hasQueue) return null;
    }
  }
  const t = (text || "").trim();

  // Hang doi nhieu bai — xu ly truoc vi chi co o luong nay.
  if (hasQueue) {
    const pick = t.match(/^(?:đăng|dang)\s+([\d,\s]+)$/i);
    if (pick) {
      const nums = pick[1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      const done = [];
      for (const n of nums) {
        const item = queue[n - 1];
        if (!item) { done.push(`Khong co bai so ${n}`); continue; }
        if (item.video) await sendVideoToChannel(item.video, item.caption);
        else if (item.photo) await sendPhotoToChannel(item.photo, item.caption);
        // Bai tu nguon chinh chu (YouTube/tin tuc) khong kem file media ma di kem
        // LINK — gui dang xem truoc de Telegram tu hien the video/anh cua trang do,
        // dung format anh Phong thich.
        else await sendLinkPreviewToChannel(item.caption);
        done.push(`Da dang bai so ${n} len kenh cong dong`);
      }
      await db.setKv(QUEUE_KEY, null);
      return done.join("\n");
    }
    if (isXCommand(t, /^(bỏ|bo|huỷ|huy|khong|không)(\s|$|[,.!?])/i)) {
      await db.setKv(QUEUE_KEY, null);
      return "Da bo ca lo bai X, khong dang bai nao.";
    }
    if (RESEND_RE.test(t)) {
      for (let i = 0; i < queue.length; i++) {
        await sendMessage(`===== BAI ${i + 1}/${queue.length} — ${queue[i].score}/10 =====\n\n${queue[i].caption}`);
      }
      await sendMessage('Reply "dang 1" hoac "dang 1,3" de dang bai anh chon.');
      return " ";
    }
    return null; // cau khac -> nha cho luong khac xu ly
  }

  if (/^s(ử|u)a:\s*/i.test(t)) {
    const body = t.replace(/^s(ử|u)a:\s*/i, "").trim();
    const caption = `${body}\n\n(Nguon: X @${pending.handle})\n${pending.tweetUrl}`;
    await db.setKv(PENDING_KEY, { ...pending, caption });
    await sendMessage("Da sua loi. Ban moi:\n\n" + caption + '\n\nReply "dang" de dang, "bo" de huy.');
    return " ";
  }
  // "Gui lai", "cho xem lai", "gui lai toi xem" = anh Phong muon XEM LAI ban nhap,
  // TUYET DOI khong phai lenh dang. Truoc day "gui" nam trong nhom dong tu dang nen
  // "Gui lai" bi hieu la "dang di" -> bai rac len thang kenh cong dong khong qua duyet.
  if (RESEND_RE.test(t)) {
    await sendMessage("Ban nhap dang cho duyet:\n\n" + pending.caption);
    await sendMessage('Reply "dang" de dang len kenh, "sua: ..." de sua loi, "bo" de bo.');
    return " ";
  }
  // Chi nhan lenh dang khi ro rang. Da BO "gui/gửi" khoi nhom nay vi qua da nghia.
  if (isXCommand(t, /^(đăng|dang|duyệt|duyet|ok|oke|oki)(\s|$|[,.!?])/i)) {
    if (pending.video) await sendVideoToChannel(pending.video, pending.caption);
    else if (pending.photo) await sendPhotoToChannel(pending.photo, pending.caption);
    await db.setKv(PENDING_KEY, null);
    return "Da dang bai X len kenh cong dong.";
  }
  // Doi bai khac: "chon bai khac", "tim bai khac", "chu de khac" -> bo bai dang treo,
  // KHONG dang. Truoc day cau nay roi xuong lop khac va bi hieu nham thanh de xuat
  // chu de bai viet cho persona, sai hoan toan ngu canh.
  if (/(khác|khac)\b/i.test(t) && /(bài|bai|chủ đề|chu de|cái|cai|video|tin)/i.test(t)) {
    await db.setKv(PENDING_KEY, null);
    return "Da bo bai X nay. Nhi se tim bai khac dung chuyen mon hon o luot quet sau (hoac go /baix de tim ngay).";
  }
  // Dung (\s|$|dau cau) thay cho \b: \b khong nhan dien duoc chu ket thuc bang
  // nguyen am co dau ("bỏ", "huỷ") nen truoc day lenh bo bai X khong an.
  if (isXCommand(t, /^(bỏ|bo|huỷ|huy|khong|không)(\s|$|[,.!?])/i)) {
    await db.setKv(PENDING_KEY, null);
    return "Da huy bai X, khong dang.";
  }
  return null;
}

// ===== TU DONG LUNG BAI X HOT VE AI (qua Apify) =====
// X chan tim kiem tu dong an danh, nhung actor Apify kaitoeasyapi (chay duoc tren
// goi free) van search duoc theo tu khoa + loc chi bai co VIDEO. Nhi tu tim bai
// AI viral moi -> viet nhap -> gui anh Phong duyet.
const APIFY_ACTOR = "kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest";
const SENT_IDS_KEY = "x_repost_sent_ids";

// Lay danh sach ban mp4 (uu tien bitrate cao) tu 1 tweet, hoac null neu khong co video.
function videoVariants(tweet) {
  const media = (tweet.extendedEntities && tweet.extendedEntities.media) || [];
  for (const m of media) {
    if (m.video_info && Array.isArray(m.video_info.variants)) {
      const mp4 = m.video_info.variants
        .filter((v) => v.content_type === "video/mp4")
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (mp4.length) return mp4;
    }
  }
  return null;
}

// Chon ban mp4 <= 20MB (gioi han Telegram gui qua URL); khong ro size thi lay ban nho nhat.
async function pickSendableMp4(variants) {
  for (const v of variants) {
    try {
      const h = await fetch(v.url, { method: "HEAD" });
      const size = Number(h.headers.get("content-length") || 0);
      if (size > 0 && size <= 20 * 1024 * 1024) return v.url;
    } catch (e) { /* thu ban tiep */ }
  }
  return variants.length ? variants[variants.length - 1].url : null;
}

// ===== BO LOC CHAT LUONG NOI DUNG KENH CONG DONG =====
// Kenh la kenh CHUYEN MON ve AI ung dung trong kinh doanh, khong phai kenh giai tri.
// Truoc day khong kiem tra lai sau khi Apify tra ve -> lot ca video "hai AI" va bai
// khong lien quan gi den cong cu AI (vd extension fact-check chinh tri).

// Bai PHAI nhac den it nhat 1 trong so nay moi duoc xet.
const REQUIRED_TERMS = [
  "higgsfield", "heygen", "elevenlabs", "topview", "jogg", "base44",
  "ai influencer", "virtual influencer", "ai avatar", "ai ugc", "ugc ad",
  "ai video", "ai voice", "voice clone", "text to video", "image to video",
  "ai agent", "ai automation", "ai workflow", "vibe coding", "ai marketing", "ai ads",
];

// Tin hieu giai tri/hai huoc/drama -> loai thang, du co viral toi dau.
const REJECT_TERMS = [
  "cartoon", "animation test", "animated short", "disney", "pixar", "anime edit",
  "funny", "hilarious", "lol", "lmao", "meme", "joke", "prank", "comedy", "skit",
  "brainrot", "cursed", "rizz", "troll", "cringe", "parody", "satire", "roast",
  "gone wrong", "reaction", "tier list", "ranking every", "drama", "beef",
];

function textOf(t) {
  return String((t && t.text) || "").toLowerCase();
}

function passesKeywordGate(t) {
  const s = textOf(t);
  if (!s) return false;
  if (REJECT_TERMS.some((w) => s.includes(w))) return false;
  return REQUIRED_TERMS.some((w) => s.includes(w));
}

// Cua ai cuoi cung: AI doc bai va cham diem co hop kenh chuyen mon khong.
// Bat duoc cac bai "dung tu khoa nhung noi dung nham" ma regex khong the loc.
async function scoreRelevance(tweetText) {
  const { chatComplete } = require("../ai");
  const system =
    `Ban la bien tap vien KHO TINH cua kenh cong dong "KOL AI GO GLOBAL" — kenh CHUYEN MON ` +
    `ve AI ung dung trong KINH DOANH (lam noi dung, ban hang, tu dong hoa, affiliate). ` +
    `Doc gia la nguoi lam MMO/affiliate/chu shop, ho vao day de HOC LAM RA TIEN, khong phai de giai tri.\n\n` +
    `Cham diem bai X duoi day tu 0-10:\n` +
    `- 9-10: co CONG CU CU THE + quy trinh/cach lam ro rang, hoac so lieu kinh doanh that (doanh thu, ty le chuyen doi, thoi gian tiet kiem), hoac tin ra mat tinh nang quan trong dung duoc ngay.\n` +
    `- 6-8: dung chu de nhung nong, doc xong chua lam theo duoc gi cu the.\n` +
    `- 0-5: LOAI. Gom: video hoat hinh/animation/nhan vat che, demo khoe ky xao don thuan, meme, hai huoc, drama, khoe anh dep, tin chinh tri/xa hoi, bai chi de gay sock hoac cau view.\n\n` +
    `QUY TAC: bai chi "trong dep/an tuong" ma khong day duoc gi thi TOI DA 5 diem, du viral toi dau. ` +
    `Neu khong chac chan, cham diem THAP.\n` +
    `Chi tra ve DUY NHAT JSON: {"score": <so>, "reason": "<mot cau ngan tieng Viet khong dau>"}`;
  try {
    const raw = await chatComplete({ system, messages: [{ role: "user", content: tweetText.slice(0, 1200) }], maxTokens: 80, temperature: 0 });
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { score: 0, reason: "khong cham diem duoc" };
    const p = JSON.parse(m[0]);
    return { score: Number(p.score) || 0, reason: String(p.reason || "") };
  } catch (e) {
    return { score: 0, reason: "loi cham diem: " + e.message };
  }
}

const MIN_RELEVANCE_SCORE = 9;

// Tim bai X viral ve AI co video (14 ngay gan day, du luot thich).
async function searchViralAiVideos() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Thieu APIFY_TOKEN");
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  // BAM DUNG 6 tool anh Phong lam affiliate + AI ung dung trong kinh doanh.
  // DA BO "AI model"/"AI actress"/"AI film" — qua long, keo ve video AI giai tri.
  const input = {
    twitterContent:
      '(Higgsfield OR HeyGen OR ElevenLabs OR Topview OR "Jogg AI" OR Base44 OR "AI influencer" OR "virtual influencer" OR "AI avatar" OR "AI UGC" OR "AI agent" OR "vibe coding")',
    queryType: "Videos",
    lang: "en",
    "min_faves": 800,
    maxItems: 40,
    since,
  };
  const r = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=150`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!r.ok) throw new Error(`Apify loi HTTP ${r.status}`);
  const items = await r.json();
  return (Array.isArray(items) ? items : []).filter((t) => t && t.id && videoVariants(t));
}

// May tu lung: tim bai X hot MOI -> Nhi viet nhap -> gui anh Phong duyet.
async function proposeXPost({ sendMessage, sendVideo }) {
  const sent = (await db.getKv(SENT_IDS_KEY)) || [];
  const sentSet = new Set(sent);

  const tweets = await searchViralAiVideos();
  // Cua 1 (regex, mien phi): phai nhac cong cu/chu de AI ung dung, khong dinh tu
  // khoa giai tri. Loc truoc de khong ton token cham diem cho bai ro rang lac de.
  const candidates = tweets
    .filter((t) => !sentSet.has(t.id) && passesKeywordGate(t))
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  if (!candidates.length) {
    if (sendMessage) await sendMessage("Hom nay khong co bai X nao dung chu de AI ung dung de de xuat.");
    return { proposed: 0 };
  }

  // Cua 2 (AI cham diem): duyet tu bai nhieu tim nhat xuong, lay bai dau tien dat
  // chuan chuyen mon. Bai truot van danh dau da xet de khong lap lai ngay mai.
  let t = null;
  let scored = null;
  const rejected = [];
  for (const cand of candidates.slice(0, 8)) {
    const s = await scoreRelevance(cand.text || "");
    if (s.score >= MIN_RELEVANCE_SCORE) { t = cand; scored = s; break; }
    rejected.push(cand.id);
  }
  if (!t) {
    await db.setKv(SENT_IDS_KEY, [...sent, ...rejected].slice(-300));
    if (sendMessage) await sendMessage(`Hom nay co ${candidates.length} bai X viral nhung khong bai nao du chuan chuyen mon (toan giai tri/chung chung) — Nhi khong de xuat.`);
    return { proposed: 0, rejected: rejected.length };
  }
  sent.push(...rejected);
  const videoUrl = await pickSendableMp4(videoVariants(t));
  const handle = (t.author && (t.author.userName || t.author.screenName)) || "";
  const tweetUrl = t.url || t.twitterUrl || `https://x.com/${handle}/status/${t.id}`;
  const body = await writeCaption({ text: t.text || "", handle });
  const caption = `${body}\n\n(Nguon: X @${handle} — ${t.likeCount || 0} luot thich)\n${tweetUrl}`;

  await db.setKv(PENDING_KEY, { id: t.id, handle, tweetUrl, video: videoUrl, caption, at: Date.now() });
  // Danh dau da xet (du duyet hay khong cung khong de xuat lai bai nay)
  await db.setKv(SENT_IDS_KEY, [...sent, t.id].slice(-300));

  await sendMessage(
    `NHI TIM DUOC BAI X HOT VE AI — duyet dang len kenh cong dong:\n` +
    `(Diem phu hop chuyen mon: ${scored.score}/10 — ${scored.reason})\n\n` + caption
  );
  if (videoUrl) await sendVideo(videoUrl, "Video se dang kem (xem thu)");
  await sendMessage('Reply "dang" de dang len kenh, "sua: ..." de sua loi, "bo" de bo.');
  return { proposed: 1, id: t.id, likes: t.likeCount, score: scored.score };
}

// De xuat NHIEU bai mot luot de anh Phong xem roi chon ("dang 1,3").
// Khac proposeXPost (1 bai/lan) — dung khi muon xem vai lua chon cung luc.
async function proposeXPosts({ sendMessage, sendVideo, count = 3 }) {
  const sent = (await db.getKv(SENT_IDS_KEY)) || [];
  const sentSet = new Set(sent);

  const tweets = await searchViralAiVideos();
  const candidates = tweets
    .filter((t) => !sentSet.has(t.id) && passesKeywordGate(t))
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));

  const picked = [];
  const seen = [];
  for (const cand of candidates.slice(0, 14)) {
    if (picked.length >= count) break;
    const s = await scoreRelevance(cand.text || "");
    seen.push(cand.id);
    if (s.score < MIN_RELEVANCE_SCORE) continue;
    const handle = (cand.author && (cand.author.userName || cand.author.screenName)) || "";
    const body = await writeCaption({ text: cand.text || "", handle });
    picked.push({
      id: cand.id,
      handle,
      tweetUrl: cand.url || cand.twitterUrl || `https://x.com/${handle}/status/${cand.id}`,
      video: await pickSendableMp4(videoVariants(cand)),
      caption: `${body}\n\n(Nguon: X @${handle} — ${cand.likeCount || 0} luot thich)\n${cand.url || `https://x.com/${handle}/status/${cand.id}`}`,
      score: s.score,
      reason: s.reason,
      likes: cand.likeCount || 0,
    });
  }

  // Bai da xet (dat hay khong) deu danh dau de khong de xuat lai ngay mai.
  await db.setKv(SENT_IDS_KEY, [...sent, ...seen].slice(-300));

  if (!picked.length) {
    await sendMessage(`Da quet ${candidates.length} bai X viral nhung khong bai nao dat chuan chuyen mon (>= ${MIN_RELEVANCE_SCORE}/10). Nhi khong de xuat bai vot.`);
    return { proposed: 0 };
  }

  await db.setKv(QUEUE_KEY, picked);
  await db.setKv(PENDING_KEY, null); // dung hang doi, khong dung luong 1 bai
  await sendMessage(`NHI CHON DUOC ${picked.length} BAI CHO KENH CONG DONG — anh xem roi chon:`);
  for (let i = 0; i < picked.length; i++) {
    const p = picked[i];
    await sendMessage(`===== BAI ${i + 1}/${picked.length} — ${p.score}/10 =====\n(${p.reason})\n\n${p.caption}`);
    if (p.video) await sendVideo(p.video, `Video bai ${i + 1} (xem thu)`);
  }
  await sendMessage(`Reply "dang 1" hoac "dang 1,3" de dang bai anh chon len kenh.\nReply "bo" neu khong dang bai nao.`);
  return { proposed: picked.length };
}

module.exports = { hasXLink, handleXLink, handleXApproval, proposeXPost, proposeXPosts, searchViralAiVideos, passesKeywordGate, scoreRelevance };
