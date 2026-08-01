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
const { sendVideoToChannel, sendPhotoToChannel } = require("./channel-broadcast");

const PENDING_KEY = "x_repost_pending";
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
async function handleXApproval(text, { sendMessage }) {
  const pending = await db.getKv(PENDING_KEY);
  if (!pending) return null;
  const t = (text || "").trim();

  if (/^s(ử|u)a:\s*/i.test(t)) {
    const body = t.replace(/^s(ử|u)a:\s*/i, "").trim();
    const caption = `${body}\n\n(Nguon: X @${pending.handle})\n${pending.tweetUrl}`;
    await db.setKv(PENDING_KEY, { ...pending, caption });
    await sendMessage("Da sua loi. Ban moi:\n\n" + caption + '\n\nReply "dang" de dang, "bo" de huy.');
    return " ";
  }
  if (/^(đăng|dang|duyệt|duyet|ok|oke|gửi|gui)\b/i.test(t)) {
    if (pending.video) await sendVideoToChannel(pending.video, pending.caption);
    else if (pending.photo) await sendPhotoToChannel(pending.photo, pending.caption);
    await db.setKv(PENDING_KEY, null);
    return "Da dang bai X len kenh cong dong.";
  }
  if (/^(bỏ|bo|huỷ|huy|khong|không)\b/i.test(t)) {
    await db.setKv(PENDING_KEY, null);
    return "Da huy bai X, khong dang.";
  }
  return null;
}

module.exports = { hasXLink, handleXLink, handleXApproval };
