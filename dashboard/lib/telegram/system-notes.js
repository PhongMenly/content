/**
 * Ghi chu hien trang he thong — nguon su that de Uyen Nhi khong doan mo.
 * Phong cap nhat qua lenh Telegram /hientrang hoac trang Cai dat.
 * Duoc inject vao MOI cau tra loi cho owner.
 */
const db = require("../../db/client");

const KV_KEY = "system_notes";

async function getSystemNotes() {
  const saved = await db.getKv(KV_KEY);
  return (saved && saved.notes) || [];
}

async function setSystemNotes(notes) {
  await db.setKv(KV_KEY, { notes, updatedAt: new Date().toISOString() });
}

async function appendSystemNote(text) {
  const notes = await getSystemNotes();
  const stamp = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  notes.push(`[${stamp}] ${text}`);
  // Giu toi da 30 ghi chu gan nhat
  await setSystemNotes(notes.slice(-30));
  return notes.length;
}

async function clearSystemNotes() {
  await setSystemNotes([]);
}

function formatNotesBlock(notes) {
  if (!notes || notes.length === 0) return "";
  return (
    "\n===== GHI CHU HIEN TRANG TU PHONG (su that moi nhat, uu tien tuyet doi khi tra loi) =====\n" +
    notes.map((n) => `- ${n}`).join("\n")
  );
}

module.exports = { getSystemNotes, setSystemNotes, appendSystemNote, clearSystemNotes, formatNotesBlock };
