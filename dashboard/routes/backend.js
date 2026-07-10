/**
 * Backend Marketing — cho Phong nhin thay toan bo cong viec ung dung tu chay:
 * cac may tu dong (cron), dong thoi gian 48h toi, va nhat ky hoat dong gan day.
 */
const express = require("express");
const db = require("../db/client");

const router = express.Router();

const VN_OFFSET = 7 * 3600 * 1000;

function nowVN() {
  return new Date(Date.now() + VN_OFFSET);
}

// Tinh lan chay ke tiep (tra ve Date theo UTC that) cho lich hang ngay gio VN
function nextDailyVN(hour, minute) {
  const vn = nowVN();
  const candidate = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), hour, minute) - VN_OFFSET);
  if (candidate.getTime() <= Date.now()) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
}

function nextWeeklyVN(dayOfWeek, hour, minute) {
  // dayOfWeek: 1 = thu 2
  const d = nextDailyVN(hour, minute);
  for (let i = 0; i < 7; i += 1) {
    const vnDay = new Date(d.getTime() + VN_OFFSET).getUTCDay();
    if (vnDay === dayOfWeek) return d;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function nextInterval(minutes) {
  const ms = minutes * 60 * 1000;
  return new Date(Math.ceil(Date.now() / ms) * ms);
}

// Danh sach may tu dong — khop voi dashboard/vercel.json
function getAutomationJobs() {
  return [
    { name: "Tự đăng bài lên Facebook (qua Make)", freq: "5 phút/lần", group: "Đăng bài", next: nextInterval(5) },
    { name: "Gửi bài chờ duyệt + báo kết quả qua Telegram", freq: "5 phút/lần", group: "Duyệt bài", next: nextInterval(5) },
    { name: "Đồng bộ số liệu like/comment/share", freq: "1 giờ/lần", group: "Số liệu", next: nextInterval(60) },
    { name: "Bản tin AI lên kênh KOL AI GO GLOBAL (1 tin + ảnh)", freq: "7:30 sáng hàng ngày", group: "Kênh cộng đồng", next: nextDailyVN(7, 30) },
    { name: "AI đề xuất chủ đề mới cho Uyên Linh", freq: "8:00 sáng hàng ngày", group: "Ý tưởng", next: nextDailyVN(8, 0) },
    { name: "Báo cáo insight khách hàng qua Telegram", freq: "8:00 sáng hàng ngày", group: "Báo cáo", next: nextDailyVN(8, 0) },
    { name: "Backup toàn bộ dữ liệu", freq: "2:00 sáng hàng ngày", group: "An toàn", next: nextDailyVN(2, 0) },
    { name: "AI đề xuất chủ đề tuần (Phong Menly)", freq: "8:00 sáng thứ 2", group: "Ý tưởng", next: nextWeeklyVN(1, 8, 0) },
  ];
}

router.get("/overview", async (req, res, next) => {
  try {
    const jobs = getAutomationJobs().sort((a, b) => a.next - b.next);

    // Dong thoi gian 48h toi: bai da len lich + cac job hang ngay
    const posts = await db.listPosts({});
    const horizon = Date.now() + 48 * 3600 * 1000;
    const timeline = [];

    posts
      .filter((p) => p.status === "scheduled" && p.scheduled_time && p.scheduled_time * 1000 <= horizon)
      .forEach((p) => timeline.push({
        at: p.scheduled_time * 1000,
        type: "post",
        label: `Đăng bài #${p.id}: ${p.title || p.slug}`,
      }));

    jobs
      .filter((j) => !j.freq.includes("phút") && !j.freq.includes("giờ/lần"))
      .forEach((j) => {
        if (j.next.getTime() <= horizon) timeline.push({ at: j.next.getTime(), type: "job", label: j.name });
      });

    timeline.sort((a, b) => a.at - b.at);

    // Nhat ky hoat dong gan day
    const history = await db.getRecentHistory(25);

    res.json({
      jobs: jobs.map((j) => ({ ...j, next: j.next.getTime() })),
      timeline,
      history,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
