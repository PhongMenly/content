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
// mode "watch": may canh truc 24/7, quet lien tuc — khong hien dem nguoc (gay hieu lam)
// mode "scheduled": chay dung gio co dinh — hien dem nguoc den lan chay ke tiep
function getAutomationJobs() {
  return [
    {
      name: "Máy đăng bài",
      desc: "Trực 24/7, canh các bài đã lên lịch. Bài nào đến giờ là tự đăng lên Facebook (qua Make) trong vòng tối đa 5 phút.",
      group: "Đăng bài", mode: "watch", freq: "quét 5 phút/lần", next: nextInterval(5),
    },
    {
      name: "Máy trợ lý duyệt bài",
      desc: "Trực 24/7, canh bài viết mới. AI viết xong bài nào là gửi ngay lên Telegram cho bạn duyệt, và báo kết quả sau khi đăng.",
      group: "Duyệt bài", mode: "watch", freq: "quét 5 phút/lần", next: nextInterval(5),
    },
    {
      name: "Máy đồng bộ số liệu",
      desc: "Mỗi giờ tự lấy số like, bình luận, chia sẻ mới nhất từ Facebook về bảng Thống kê.",
      group: "Số liệu", mode: "watch", freq: "1 giờ/lần", next: nextInterval(60),
    },
    {
      name: "Bản tin AI cho kênh cộng đồng",
      desc: "Chọn 1 tin AI quan trọng nhất trong ngày (ưu tiên affiliate, doanh nghiệp 1 người, AI Influencer), kèm ảnh gốc, đăng lên kênh KOL AI GO GLOBAL.",
      group: "Kênh cộng đồng", mode: "scheduled", freq: "7:30 sáng hàng ngày", next: nextDailyVN(7, 30),
    },
    {
      name: "Máy giữ kho bài Uyên Linh",
      desc: "Trực 24/7, giữ kho nội dung (ý tưởng + chờ duyệt + đã lên lịch) luôn tối thiểu 6 bài. Đăng bớt bài là AI tự đề xuất chủ đề bù ngay và gửi Telegram cho bạn chọn — không chờ đến sáng.",
      group: "Ý tưởng", mode: "watch", freq: "quét 5 phút/lần", next: nextInterval(5),
    },
    {
      name: "Báo cáo insight khách hàng",
      desc: "Tổng hợp những gì khách hỏi bot, nỗi đau, câu hỏi thường gặp — gửi báo cáo qua Telegram.",
      group: "Báo cáo", mode: "scheduled", freq: "8:00 sáng hàng ngày", next: nextDailyVN(8, 0),
    },
    {
      name: "Backup toàn bộ dữ liệu",
      desc: "Sao lưu toàn bộ bài viết, lịch sử, số liệu ra kho lưu trữ an toàn. Giữ 14 bản gần nhất.",
      group: "An toàn", mode: "scheduled", freq: "2:00 sáng hàng ngày", next: nextDailyVN(2, 0),
    },
    {
      name: "AI đề xuất chủ đề tuần (Phong Menly)",
      desc: "Sáng thứ 2 hàng tuần, AI đề xuất 5 chủ đề mới cho thương hiệu Phong Menly.",
      group: "Ý tưởng", mode: "scheduled", freq: "8:00 sáng thứ 2", next: nextWeeklyVN(1, 8, 0),
    },
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
