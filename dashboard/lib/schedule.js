// Moi tinh toan lich dang deu neo theo gio Viet Nam (UTC+7),
// de code chay o server nuoc ngoai (Vercel/UTC) van ra dung khung gio.
const VN_OFFSET_HOURS = 7;

function toUnixTime(scheduleArg) {
  let s = String(scheduleArg).trim();
  // "2026-07-05 09:00" (khong co mui gio) -> hieu la gio Viet Nam
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    s = s.replace(" ", "T") + "+07:00";
  }
  const date = new Date(s);
  if (isNaN(date.getTime())) {
    throw new Error(`Khong doc duoc thoi gian: ${scheduleArg}. Dung dinh dang "2026-07-05 09:00"`);
  }
  const unix = Math.floor(date.getTime() / 1000);
  const minAllowed = Math.floor(Date.now() / 1000) + 600;
  if (unix < minAllowed) {
    throw new Error("Facebook yeu cau lich dang toi thieu 10 phut sau thoi diem hien tai");
  }
  return unix;
}

// 2 khung gio dang co dinh: 11:00 va 21:00 gio Viet Nam
const SLOT_HOURS = [11, 21];

function nextAvailableSlot(takenTimes) {
  const taken = new Set(takenTimes.map(Number));
  const minAllowed = Math.floor(Date.now() / 1000) + 600;

  // Lay ngay hien tai theo gio Viet Nam
  const nowVN = new Date(Date.now() + VN_OFFSET_HOURS * 3600 * 1000);
  let y = nowVN.getUTCFullYear();
  let m = nowVN.getUTCMonth();
  let d = nowVN.getUTCDate();

  for (let i = 0; i < 60; i += 1) {
    for (const hour of SLOT_HOURS) {
      // hour gio VN = (hour - 7) gio UTC
      const unix = Math.floor(Date.UTC(y, m, d + i, hour - VN_OFFSET_HOURS, 0, 0) / 1000);
      if (unix >= minAllowed && !taken.has(unix)) {
        return unix;
      }
    }
  }
  throw new Error("Khong tim duoc khung gio trong");
}

// Hien thi thoi gian cho anh Phong doc. BAT BUOC neo timeZone Asia/Ho_Chi_Minh:
// server chay o Vercel (mui gio UTC), thieu tham so nay se in ra gio UTC — vd
// lich 21:00 gio VN bi hien thanh 14:00, nhin nhu he thong xep sai khung gio.
function formatVN(unixSeconds) {
  if (!unixSeconds) return "chua ro";
  return new Date(Number(unixSeconds) * 1000).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

module.exports = { toUnixTime, nextAvailableSlot, formatVN };
