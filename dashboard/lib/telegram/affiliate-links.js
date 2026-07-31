/**
 * NGUON DUY NHAT cho link affiliate cua anh Phong (lay dung tu brain.js).
 * Moi noi dang tu dong (ban tin AI, gioi thieu tool...) deu lay link tu day de
 * KHONG BAO GIO gan sai link. Khi doi link affiliate, chi sua o file nay.
 *
 * `match` la regex khop ten tool trong tieu de/noi dung tin.
 */
const AFFILIATE_LINKS = [
  { name: "Higgsfield", match: /higgsfield/i, url: "https://higgsfield.ai/?fpr=twt6ij" },
  { name: "Topview AI", match: /top\s*view/i, url: "https://www.topview.ai/?via=KOLAI" },
  { name: "Lovable", match: /lovable/i, url: "https://lovable.dev/?via=phong" },
  { name: "HeyGen", match: /heygen/i, url: "https://www.heygen.com/?sid=rewardful&utm_content=creator&utm_medium=affiliate&via=phongpml" },
  { name: "Jogg AI", match: /jogg\s*ai|joggai/i, url: "https://www.jogg.ai/?fpr=phongmenly" },
  { name: "BASE44", match: /base\s*44/i, url: "https://base44.pxf.io/c/7117685/2049275/25619?trafcat=base" },
  { name: "ElevenLabs", match: /eleven\s*labs/i, url: "https://try.elevenlabs.io/3s2obuawcuj7" },
  { name: "OpenArt", match: /open\s*art/i, url: "https://openart.ai/home/?via=phong" },
  { name: "PitPit", match: /pit\s*pit|pippit/i, url: "https://pippitcreator.pxf.io/Gb0Ngm" },
  { name: "Whop", match: /\bwhop\b/i, url: "https://whop.com/?a=phongtyphu" },
];

// Tra ve link affiliate dung neu text (tieu de + noi dung tin) nhac toi 1 tool
// anh Phong dang lam affiliate; khong khop tool nao -> null (khong gan link bua).
function affiliateLinkFor(text) {
  const hit = AFFILIATE_LINKS.find((l) => l.match.test(text || ""));
  return hit ? hit.url : null;
}

module.exports = { AFFILIATE_LINKS, affiliateLinkFor };
