const db = require("../../db/client");
const { getContentInsights } = require("../post-insights");
const { getSystemNotes, formatNotesBlock } = require("./system-notes");

function formatVN(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

const STATUS_LABELS = {
  idea: "y tuong",
  draft: "ban nhap",
  ready_for_review: "cho duyet",
  scheduled: "da len lich",
  posted: "da dang",
  failed: "loi",
  archived: "luu tru",
};

// Snapshot du lieu that cua du an, inject vao system prompt moi lan owner nhan tin —
// de AI luon tra loi dua tren trang thai THAT cua dashboard, khong doan mo.
async function getOwnerContext() {
  const all = await db.listPosts({});
  const byStatus = {};
  for (const p of all) byStatus[p.status] = (byStatus[p.status] || 0) + 1;

  const statusSummary = Object.entries(byStatus)
    .map(([s, c]) => `${STATUS_LABELS[s] || s}: ${c}`)
    .join(", ");

  const needsAttention = all
    .filter((p) => ["idea", "ready_for_review", "failed"].includes(p.status))
    .slice(0, 10)
    .map((p) => `#${p.id} [${STATUS_LABELS[p.status] || p.status}] ${p.title || p.slug}`);

  const insights = await getContentInsights();
  const insightLine = insights.enough_data
    ? `Hieu suat: trung binh ${insights.baseline_avg_engagement} tuong tac/bai (${insights.posted_count} bai da dang co so lieu). Pillar tot nhat: ${insights.by_pillar[0]?.label || "chua ro"}.`
    : `Hieu suat: chua du du lieu (${insights.posted_count}/${insights.min_required} bai da dang co so lieu).`;

  const lines = [
    "\n===== TRANG THAI DU AN HIEN TAI (du lieu that tu dashboard, luon dung so nay khi tra loi) =====",
    `Tong so bai trong he thong: ${all.length} (${statusSummary || "chua co bai nao"})`,
  ];

  if (needsAttention.length) {
    lines.push("Bai dang can xu ly (y tuong / cho duyet / loi):");
    lines.push(...needsAttention);
  }

  // Lich dang sap toi (5 bai gan nhat)
  const upcoming = all
    .filter((p) => p.status === "scheduled" && p.scheduled_time)
    .sort((a, b) => a.scheduled_time - b.scheduled_time)
    .slice(0, 5);
  if (upcoming.length) {
    lines.push("Lich dang sap toi (gio VN):");
    upcoming.forEach((p) => lines.push(`- ${formatVN(p.scheduled_time)}: #${p.id} ${p.title || p.slug}`));
  } else {
    lines.push("Lich dang sap toi: TRONG — can de xuat/duyet bai moi.");
  }

  lines.push(insightLine);

  // Cau hinh dinh huong noi dung hien tai
  try {
    const kw = await db.getKv("topic_keywords");
    if (kw && kw.keywords && kw.keywords.length) {
      lines.push(`Tu khoa dinh huong y tuong dang dat: ${kw.keywords.join(", ")}`);
    }
    const ref = await db.getKv("reference_channel");
    if (ref && ref.channelTitle) {
      lines.push(`Kenh mau dang hoc theo: ${ref.channelTitle}`);
    }
    const brand = await db.getKv("brand_profile");
    lines.push(brand && brand.text ? "Ho so thuong hieu: DA CO (AI dang bam theo khi viet)" : "Ho so thuong hieu: chua phan tich");
  } catch (e) {
    // bo qua neu kv loi
  }

  lines.push(`Dashboard: https://phong-menly-dashboard.vercel.app`);

  // Ghi chu hien trang do Phong tu cap nhat — nguon su that cao nhat
  const notes = await getSystemNotes();
  const notesBlock = formatNotesBlock(notes);
  if (notesBlock) lines.push(notesBlock);
  lines.push(
    "QUY TAC: Neu thong tin khong co trong cac muc tren, NOI THAT la chua ro va hoi lai Phong. TUYET DOI khong tu bia trang thai he thong."
  );

  return lines.join("\n");
}

module.exports = { getOwnerContext };
