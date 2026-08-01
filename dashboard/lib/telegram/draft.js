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
// Kho anh theo persona. Uyen Linh CHI duoc lay muc KOLAI — khong bao gio doi sang
// muc khac, du kho co can. Phong Menly lay muc "Su kien".
const FOLDER_BY_BRAND = { uyen_linh: "KOLAI", phong_menly: "SUKIEN" };
const STRICT_BRANDS = ["uyen_linh"]; // het anh thi bao, tuyet doi khong muon muc khac

function normFolder(folder) {
  return (folder || "").toUpperCase().replace(/\s+/g, "");
}

function wantedFolder(brandKey) {
  return FOLDER_BY_BRAND[brandKey] || FOLDER_BY_BRAND.phong_menly;
}

async function pickLibraryImage(brandKey, postId) {
  const imgs = await db.listLibraryImages();
  if (!imgs.length) return null;

  const want = wantedFolder(brandKey);
  const inFolder = imgs.filter((i) => normFolder(i.folder).includes(want));

  // Anh "con moi" = chua bao gio bi danh dau da lay. Truoc day chi suy ra tu 30 bai
  // gan nhat (cua so truot) nen sau 30 bai la anh quay vong, dang lai anh cu.
  let pool = inFolder.filter((i) => !i.used_at);

  if (!pool.length) {
    if (!inFolder.length && STRICT_BRANDS.includes(brandKey)) {
      console.warn(`[pickLibraryImage] Kho khong co anh muc ${want} cho ${brandKey} — khong gan anh`);
      return null;
    }
    if (!inFolder.length) {
      console.warn(`[pickLibraryImage] Kho khong co anh muc ${want} — dung tam anh khac`);
      pool = imgs.filter((i) => !i.used_at);
      if (!pool.length) pool = imgs;
    } else {
      // Het anh moi trong muc -> dung lai anh cu NHUNG VAN CUNG MUC, uu tien anh
      // lau chua dung nhat. Khong bao gio nhay sang muc cua persona khac.
      console.warn(`[pickLibraryImage] Da dung het anh moi muc ${want} — dung lai anh cu lau nhat`);
      pool = [...inFolder].sort((a, b) => (a.used_at || 0) - (b.used_at || 0)).slice(0, 5);
    }
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  await db.markLibraryImageUsed(chosen.url, postId);
  return chosen.url;
}

// Viet full bai cho 1 topic (status = 'idea') -> chuyen 'ready_for_review' + bao Telegram ngay
async function draftTopic(post, { sendMessage, sendPhoto } = {}) {
  const { getBrandProfile, DEFAULT_KEY } = require("../brand-profile");
  const brandKey = post.brand_key || DEFAULT_KEY;
  const insights = await getContentInsights(brandKey);
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
    const imageUrl = await pickLibraryImage(brandKey, post.id);
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

module.exports = { completeOnce, draftTopic, pickLibraryImage };
