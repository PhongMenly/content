const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { getContentInsights } = require("../post-insights");
const { markSentAndShown, formatDraftMessage } = require("./review-flow");

const { chatComplete } = require("../ai");

const DRAFT_TASK_INSTRUCTION = `

===== NHIEM VU HIEN TAI: VIET 1 BAI FACEBOOK HOAN CHINH =====

Day KHONG PHAI mot cuoc chat. Day la nhiem vu viet noi dung.

TUYET DOI KHONG duoc xuat ra:
- Bat ky nhan de/label nao nhu "Buoc 1", "Hook:", "Outline:", "Pillar:", "CTA:"...
- Markdown dac biet: **, __, dau gach ngang dai —
- Bat ky loi giai thich, ghi chu nao ngoai noi dung bai dang

CHI duoc xuat ra DUY NHAT noi dung bai dang cuoi cung, plain text, san sang copy-paste len Facebook ngay lap tuc.

Cau truc ap dung ngam (khong ghi nhan de ra):
1. Hook — cau dau gay to mo hoac gay soc nhe, dua tren so lieu/trai nghiem that
2. Insight — quan sat tu trai nghiem thuc te
3. Huong dan/quy trinh cu the neu chu de phu hop
4. Goc nhin ca nhan / du doan xu huong
5. CTA tu nhien o cuoi (cau hoi kich thich binh luan, khong ep buoc, khong dung "tha tim nhe")

Do dai va giong dieu: neu HO SO NHAN VAT co quy dinh rieng (do dai, cach xung ho, dieu cam) thi UU TIEN TUYET DOI theo ho so. Mac dinh: 200-500 tu. Cau ngan, xuong dong thuong xuyen de de doc tren mobile. Emoji dung vua phai, khong spam.`;

function formatInsightsContext(insights) {
  if (!insights.enough_data) return "";

  const lines = [
    "\n===== HIEU SUAT NOI DUNG THAT (uu tien ap dung) =====",
    `${insights.posted_count} bai da dang, trung binh ${insights.baseline_avg_engagement} tuong tac/bai.`,
  ];

  if (insights.by_pillar.length) {
    lines.push("Pillar hieu qua nhat: " + insights.by_pillar[0].label + ` (${insights.by_pillar[0].avg_engagement} tb)`);
  }
  if (insights.top_posts.length) {
    lines.push("Bai dang thang gan day (uu tien lap lai pattern hook):");
    insights.top_posts.forEach((p) => lines.push(`- [${p.total_engagement} tuong tac] ${p.body_snippet.split("\n")[0]}`));
  }
  if (insights.bottom_posts.length) {
    lines.push("Bai dang yeu (tranh lap lai pattern nay):");
    insights.bottom_posts.forEach((p) => lines.push(`- [${p.total_engagement} tuong tac] ${p.body_snippet.split("\n")[0]}`));
  }

  return lines.join("\n");
}

async function completeOnce(systemPrompt, userPrompt) {
  return chatComplete({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 1200,
    temperature: 0.8,
  });
}

// Tu chon 1 anh tu kho cho bai moi viet: uu tien anh su kien (nguoi that),
// tranh lap lai anh cua 30 bai gan nhat
// Kho anh theo persona: uyen_linh -> "KOLAI" (anh nhan vat), phong_menly -> "Su kien".
function matchesFolder(img, wantKol) {
  const folder = (img.folder || "").toUpperCase().replace(/\s+/g, "");
  return wantKol ? folder.includes("KOLAI") : folder.includes("SUKIEN");
}

async function pickLibraryImage(brandKey) {
  const imgs = await db.listLibraryImages();
  if (!imgs.length) return null;
  const recentUrls = (await db.listPosts({})).slice(0, 30).map((p) => p.image_path).filter(Boolean);
  const wantKol = brandKey && brandKey !== "phong_menly";

  // LOC MUC TRUOC, roi moi tranh trung. Truoc day lam nguoc: loc "chua dung" tren
  // toan bo kho roi moi loc muc — het anh chua dung trong dung muc la am tham nhay
  // sang muc cua persona kia (bai Uyen Linh bi gan anh su kien cua anh Phong).
  const inFolder = imgs.filter((i) => matchesFolder(i, wantKol));
  if (inFolder.length) {
    const fresh = inFolder.filter((i) => !recentUrls.includes(i.url));
    // Het anh moi trong muc -> dung lai anh cu CUNG MUC, tuyet doi khong doi muc.
    const pool = fresh.length ? fresh : inFolder;
    return pool[Math.floor(Math.random() * pool.length)].url;
  }

  // Chi khi kho khong co anh nao dung muc moi danh phai lay tam anh khac.
  console.warn(`[pickLibraryImage] Kho khong co anh muc ${wantKol ? "KOLAI" : "Su kien"} — dung tam anh khac`);
  const fallback = imgs.filter((i) => !recentUrls.includes(i.url));
  const pool = fallback.length ? fallback : imgs;
  return pool[Math.floor(Math.random() * pool.length)].url;
}

// Viet full bai cho 1 topic (status = 'idea') -> chuyen 'ready_for_review' + bao Telegram ngay
async function draftTopic(post, { sendMessage, sendPhoto } = {}) {
  const { getBrandProfile, DEFAULT_KEY } = require("../brand-profile");
  const insights = await getContentInsights();
  const brandKey = post.brand_key || DEFAULT_KEY;
  const brandProfile = await getBrandProfile(brandKey);
  // Persona khac (vd uyen_linh): khong dung bo nao Uyen Nhi (chua dinh vi + san pham
  // + link cua Phong Menly) — viet thuan tuy theo ho so nhan vat, tranh lan giong
  const writerPreamble =
    brandKey === DEFAULT_KEY
      ? UYEN_NHI_BRAIN
      : `Ban la cay viet noi dung chuyen nghiep. Viet bai dang Facebook TIENG VIET voi tu cach chinh NHAN VAT trong ho so duoi day, ngoi thu nhat. TUYET DOI KHONG nhac den "Phong Menly", khong dung san pham/dinh vi nao ngoai ho so nhan vat.`;
  const systemPrompt =
    writerPreamble +
    `\n\n===== DINH VI THUONG HIEU (BAT BUOC BAM THEO) =====\n` +
    brandProfile +
    DRAFT_TASK_INSTRUCTION +
    formatInsightsContext(insights);
  const userPrompt =
    `Chu de: ${post.title}\n` +
    `Pillar: ${post.pillar || "tu chon phu hop nhat"}\n` +
    `Goc nhin/angle: ${post.angle || "tu quyet dinh goc nhin phu hop"}\n` +
    `Nen tang: ${post.platform || "Facebook"}\n\n` +
    `Viet full bai dang ngay.`;

  const body = await completeOnce(systemPrompt, userPrompt);

  await db.updatePost(post.id, { body });

  // Bai bat buoc co anh moi duyet/dang duoc -> tu gan anh tu kho neu chua co
  if (!post.image_path) {
    const imageUrl = await pickLibraryImage(brandKey);
    if (imageUrl) {
      await db.updatePost(post.id, { image_path: imageUrl });
      await db.logHistory({ postId: post.id, eventType: "image_uploaded", note: "Tu gan anh tu kho khi viet bai", actor: "system" });
    }
  }

  const updated = await db.updatePostStatus(post.id, "ready_for_review", {
    note: "Da viet full bai tu topic",
    actor: "system",
  });

  if (sendMessage) {
    const caption = formatDraftMessage(updated);
    if (updated.image_path && sendPhoto) {
      await sendPhoto(updated.image_path, caption);
    } else {
      await sendMessage(caption);
    }
    await markSentAndShown(updated.id);
  }

  return updated;
}

module.exports = { completeOnce, draftTopic };
