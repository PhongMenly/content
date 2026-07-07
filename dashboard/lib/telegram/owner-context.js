const db = require("../../db/client");
const { getContentInsights } = require("../post-insights");

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

  lines.push(insightLine);
  lines.push(`Dashboard: https://phong-menly-dashboard.vercel.app`);

  return lines.join("\n");
}

module.exports = { getOwnerContext };
