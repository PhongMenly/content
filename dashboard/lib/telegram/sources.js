/**
 * DANH BA NGUON CHINH CHU cho kenh cong dong "KOL AI GO GLOBAL".
 *
 * Nguyen tac anh Phong chot 2/8/2026: voi moi tu khoa, DANH THANG vao kenh cua
 * chinh doi tuong do va lay noi dung/video cua ho — KHONG search tu khoa chung
 * chung roi loc. Cach cu (quet X viral theo tu khoa) cho ra bai cua nguoi la va
 * video hai, anh Phong che "khong chuyen nghiep, bai rac".
 *
 * X handle duoi day lay TRUC TIEP tu trang chu cua tung tool (khong doan).
 */

// 6 cong cu anh Phong lam affiliate. channel_id trung voi affiliate-links.js.
const TOOLS = [
  { name: "Higgsfield", x: "higgsfield", youtube: "UCh13OyDSm-Kb8ij3yZArtFg", site: "https://higgsfield.ai/" },
  { name: "Topview", x: "TopviewAIhq", youtube: "UCvsHoSPDJwqpkVmuppvzuLg", site: "https://www.topview.ai/" },
  { name: "HeyGen", x: "HeyGen", youtube: "UCV0FmNF3iM-022BF1KbVtxA", site: "https://www.heygen.com/" },
  { name: "Jogg AI", x: "Jogg_ai", youtube: "UCxGaTZ4skg9_Ggo6fCNj8dg", site: "https://www.jogg.ai/" },
  { name: "BASE44", x: "base44", youtube: "UCSOFdbxVtrLZ4L6cJj1l6hg", site: "https://base44.com/" },
  { name: "ElevenLabs", x: "elevenlabs", youtube: "UC-ew9TfeD887qUSiWWAAj1w", site: "https://elevenlabs.io/" },
];

// AI Influencer anh Phong duyet. Cach lay anh chon: TIN TUC va cac kenh NOI VE
// ho (ky hop dong, doanh thu, chien dich thuong hieu) — khong keo feed ca nhan.
// Instagram/LinkedIn chan doc tu dong, muon keo phai mua actor Apify tra phi.
const INFLUENCERS = [
  { name: "Lil Miquela", x: "lilmiquela", query: '"Lil Miquela"' },
  { name: "Aitana Lopez", x: null, query: '"Aitana Lopez" OR "Aitana López"' },
  { name: "Noonoouri", x: null, query: '"Noonoouri"' },
  { name: "Lu do Magalu", x: null, query: '"Lu do Magalu" OR "Magalu virtual influencer"' },
];

const GOOGLE_NEWS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

// RSS YouTube cong khai — mien phi, khong can API key.
const YOUTUBE_RSS = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

// Truy van X cho tang 1: chi lay bai CUA CHINH cac tai khoan nay.
function officialXQuery() {
  const handles = [
    ...TOOLS.map((t) => t.x),
    ...INFLUENCERS.map((i) => i.x).filter(Boolean),
  ];
  return `(${handles.map((h) => `from:${h}`).join(" OR ")})`;
}

// Truy van tin tuc ve cac AI influencer (tang 2).
function influencerNewsFeeds() {
  return INFLUENCERS.map((i) => ({
    name: i.name,
    url: GOOGLE_NEWS(`${i.query} when:30d`),
  }));
}

// Tai khoan chinh chu tra loi khach hang rat nhieu ("Hey! We've replied to you
// in DMs"). Nhung tin do vo dung voi kenh -> phai loai truoc khi xet.
function isReplyTweet(t) {
  if (!t) return true;
  if (t.isReply === true) return true;
  if (t.inReplyToId || t.inReplyToUserId || t.in_reply_to_status_id) return true;
  return /^\s*@\w/.test(String(t.text || ""));
}

function toolByName(name) {
  const s = String(name || "").toLowerCase().replace(/\s+/g, "");
  return TOOLS.find((t) => s.includes(t.name.toLowerCase().replace(/\s+/g, ""))) || null;
}

module.exports = {
  TOOLS,
  INFLUENCERS,
  GOOGLE_NEWS,
  YOUTUBE_RSS,
  officialXQuery,
  influencerNewsFeeds,
  isReplyTweet,
  toolByName,
};
