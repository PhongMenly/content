/**
 * Bao cao ket qua cuoi ngay (21:30) — gui ve Telegram cho Phong:
 * hom nay dang gi, so lieu ra sao, ngay mai co gi, kho bai con bao nhieu,
 * viec gi dang cho Phong xu ly.
 */
const db = require("../../db/client");
const { countActivePipeline, MIN_PIPELINE } = require("./pipeline-guard");

const VN_OFFSET = 7 * 3600 * 1000;

function vnDayRange(offsetDays = 0) {
  const vn = new Date(Date.now() + VN_OFFSET);
  const start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + offsetDays) - VN_OFFSET;
  return { start: Math.floor(start / 1000), end: Math.floor(start / 1000) + 86400 };
}

function fmtVN(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
  });
}

async function buildDailySummary() {
  const posts = await db.listPosts({});
  const today = vnDayRange(0);
  const tomorrow = vnDayRange(1);

  const postedToday = posts.filter((p) => p.status === "posted" && p.posted_at >= today.start && p.posted_at < today.end);
  const failedToday = posts.filter((p) => p.status === "failed" && p.updated_at >= today.start);
  const scheduledTomorrow = posts
    .filter((p) => p.status === "scheduled" && p.scheduled_time >= tomorrow.start && p.scheduled_time < tomorrow.end)
    .sort((a, b) => a.scheduled_time - b.scheduled_time);
  const waitingReview = posts.filter((p) => p.status === "ready_for_review");
  const pipeline = await countActivePipeline();

  const lines = [`BAO CAO CUOI NGAY - ${new Date(Date.now() + VN_OFFSET).toLocaleDateString("vi-VN")}`];

  lines.push(`\n1. DA DANG HOM NAY: ${postedToday.length} bai`);
  postedToday.forEach((p) => {
    const metrics = ` (${p.fb_likes || 0} thich, ${p.fb_comments || 0} binh luan, ${p.fb_shares || 0} chia se)`;
    lines.push(`- ${fmtVN(p.posted_at)}: ${p.title || p.slug}${metrics}`);
  });
  if (postedToday.length === 0) lines.push("- Khong co bai nao dang hom nay");

  if (failedToday.length > 0) {
    lines.push(`\nCANH BAO - ${failedToday.length} bai LOI hom nay:`);
    failedToday.forEach((p) => lines.push(`- #${p.id} ${p.title || p.slug}`));
  }

  lines.push(`\n2. LICH NGAY MAI: ${scheduledTomorrow.length} bai`);
  scheduledTomorrow.forEach((p) => lines.push(`- ${fmtVN(p.scheduled_time)}: ${p.title || p.slug}`));
  if (scheduledTomorrow.length === 0) lines.push("- TRONG - can duyet bai de lap lich!");

  lines.push(`\n3. KHO BAI UYEN LINH: ${pipeline}/${MIN_PIPELINE} bai${pipeline < MIN_PIPELINE ? " (dang duoc AI bo sung)" : " - du"}`);

  if (waitingReview.length > 0) {
    lines.push(`\n4. DANG CHO ANH DUYET: ${waitingReview.length} bai`);
    waitingReview.forEach((p) => lines.push(`- #${p.id} ${p.title || p.slug}`));
    lines.push(`Nhan "duyet <so>" de len lich.`);
  } else {
    lines.push(`\n4. Khong co bai nao cho duyet.`);
  }

  lines.push(`\nDashboard: https://phong-menly-dashboard.vercel.app`);
  return lines.join("\n");
}

module.exports = { buildDailySummary };
