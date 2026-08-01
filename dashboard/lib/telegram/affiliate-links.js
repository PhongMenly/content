/**
 * NGUON DUY NHAT cho link affiliate cua anh Phong (lay dung tu brain.js).
 * Moi noi dang tu dong (ban tin AI, gioi thieu tool...) deu lay link tu day de
 * KHONG BAO GIO gan sai link. Khi doi link affiliate, chi sua o file nay.
 *
 * `match` la regex khop ten tool trong tieu de/noi dung tin.
 */
// `youtube` = channel_id kenh YouTube chinh thuc cua tool -> dung de lay video
// demo MOI NHAT gan vao ban tin (Telegram hien video xem duoc ngay trong bai).
// `site` = trang chu tool -> lay video mp4 demo (Telegram phat truc tiep, native).
const AFFILIATE_LINKS = [
  { name: "Higgsfield", match: /higgsfield/i, url: "https://higgsfield.ai/?fpr=twt6ij", youtube: "UCh13OyDSm-Kb8ij3yZArtFg", site: "https://higgsfield.ai/" },
  { name: "Topview AI", match: /top\s*view/i, url: "https://www.topview.ai/?via=KOLAI", youtube: "UCvsHoSPDJwqpkVmuppvzuLg", site: "https://www.topview.ai/" },
  { name: "HeyGen", match: /heygen/i, url: "https://www.heygen.com/?sid=rewardful&utm_content=creator&utm_medium=affiliate&via=phongpml", youtube: "UCV0FmNF3iM-022BF1KbVtxA", site: "https://www.heygen.com/" },
  { name: "Jogg AI", match: /jogg\s*ai|joggai/i, url: "https://www.jogg.ai/?fpr=phongmenly", youtube: "UCxGaTZ4skg9_Ggo6fCNj8dg", site: "https://www.jogg.ai/" },
  { name: "BASE44", match: /base\s*44/i, url: "https://base44.pxf.io/c/7117685/2049275/25619?trafcat=base", youtube: "UCSOFdbxVtrLZ4L6cJj1l6hg", site: "https://base44.com/" },
  { name: "ElevenLabs", match: /eleven\s*labs/i, url: "https://try.elevenlabs.io/3s2obuawcuj7", youtube: "UC-ew9TfeD887qUSiWWAAj1w", site: "https://elevenlabs.io/" },
  { name: "Lovable", match: /lovable/i, url: "https://lovable.dev/?via=phong", youtube: null, site: null },
  { name: "OpenArt", match: /open\s*art/i, url: "https://openart.ai/home/?via=phong", youtube: null, site: null },
  { name: "PitPit", match: /pit\s*pit|pippit/i, url: "https://pippitcreator.pxf.io/Gb0Ngm", youtube: null, site: null },
  { name: "Whop", match: /\bwhop\b/i, url: "https://whop.com/?a=phongtyphu", youtube: null, site: null },
];

// Tra ve entry tool khop text (tieu de + noi dung tin), hoac null.
function matchTool(text) {
  return AFFILIATE_LINKS.find((l) => l.match.test(text || "")) || null;
}

// Tra ve link affiliate dung neu text nhac toi 1 tool; khong khop -> null.
function affiliateLinkFor(text) {
  const hit = matchTool(text);
  return hit ? hit.url : null;
}

module.exports = { AFFILIATE_LINKS, affiliateLinkFor, matchTool };
