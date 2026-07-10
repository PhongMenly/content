/**
 * Vong tu hoc moi ngay cua Uyen Nhi:
 * 21h toi, doc lai hoi thoai voi anh Phong + nhat ky hanh dong trong ngay,
 * tu rut ra BAI HOC MOI (so thich, dieu cam, cach lam viec, quyet dinh chien luoc),
 * luu vao bo nho dai han va ap dung tu ngay hom sau (inject vao moi cau tra loi).
 */
const db = require("../../db/client");
const { completeOnce } = require("./draft");

const OWNER_CHAT_ID = 8481163556;
const LESSONS_KEY = "owner_lessons";
const MAX_LESSONS = 40;

async function getLessons() {
  const saved = await db.getKv(LESSONS_KEY);
  return (saved && saved.lessons) || [];
}

async function saveLessons(lessons) {
  await db.setKv(LESSONS_KEY, { lessons: lessons.slice(-MAX_LESSONS), updatedAt: new Date().toISOString() });
}

function formatLessonsBlock(lessons) {
  if (!lessons || lessons.length === 0) return "";
  return (
    "\n===== NHUNG BAI HOC NHI DA TU HOC VE CACH LAM VIEC VOI ANH PHONG (ap dung nghiem tuc) =====\n" +
    lessons.map((l) => `- ${l.text || l}`).join("\n")
  );
}

async function runDailySelfLearn({ sendMessage } = {}) {
  const conversation = (await db.getKv(`conversation:${OWNER_CHAT_ID}`)) || [];
  const history = await db.getRecentHistory(25);
  const existing = await getLessons();

  if (conversation.length === 0 && history.length === 0) {
    return { learned: 0, reason: "Khong co du lieu hom nay" };
  }

  const convoText = conversation
    .map((m) => `${m.role === "user" ? "Phong" : "Nhi"}: ${String(m.content).slice(0, 400)}`)
    .join("\n");
  const actionText = history
    .slice(0, 15)
    .map((h) => `- ${h.event_type}${h.to_status ? " -> " + h.to_status : ""}${h.title ? ` (bai: ${h.title})` : ""}${h.note ? ` | ${h.note}` : ""}`)
    .join("\n");
  const existingText = existing.map((l) => `- ${l.text || l}`).join("\n") || "(chua co)";

  const systemPrompt =
    `Bạn là Uyên Nhi — trợ lý quản lý content của anh Phong Menly — đang ngồi tự rút kinh nghiệm cuối ngày để ngày mai làm việc tốt hơn.\n` +
    `Đọc hội thoại hôm nay với anh Phong và nhật ký hành động của hệ thống. Rút ra 0-5 BÀI HỌC MỚI về CÁCH LÀM VIỆC VỚI ANH PHONG: sở thích, điều anh khen/chê, điều bị nhắc nhở, quy tắc mới, quyết định chiến lược, thói quen của anh.\n` +
    `Mỗi bài học 1 câu ngắn gọn, cụ thể, hành động được (vd: "Anh Phong muốn bài Uyên Linh ngắn 80-200 từ, giọng nhẹ nhàng, không thuật ngữ công nghệ").\n` +
    `SO SÁNH với danh sách bài học ĐÃ CÓ — chỉ trả về bài học THỰC SỰ MỚI hoặc điều chỉnh quan trọng, KHÔNG lặp lại ý đã có. Không có gì mới thì trả mảng rỗng.\n` +
    `Viết tiếng Việt có dấu. Trả về DUY NHẤT JSON: {"lessons": ["..."], "summary": "<1-2 câu Nhi tự nhận xét về ngày hôm nay>"}`;

  const userPrompt =
    `BÀI HỌC ĐÃ CÓ:\n${existingText}\n\n` +
    `HỘI THOẠI HÔM NAY:\n${convoText || "(khong chat gi)"}\n\n` +
    `NHẬT KÝ HÀNH ĐỘNG:\n${actionText || "(khong co)"}`;

  const raw = await completeOnce(systemPrompt, userPrompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Khong parse duoc ket qua tu hoc: " + raw.slice(0, 150));
  const result = JSON.parse(jsonMatch[0]);
  const newLessons = (result.lessons || []).filter((t) => t && t.trim()).slice(0, 5);

  if (newLessons.length > 0) {
    const stamp = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const merged = existing.concat(newLessons.map((text) => ({ text, learnedAt: stamp })));
    await saveLessons(merged);
  }

  if (sendMessage) {
    const lines = ["NHI TU HOC CUOI NGAY"];
    if (newLessons.length > 0) {
      lines.push(`Hom nay Nhi hoc duoc ${newLessons.length} dieu moi:`);
      newLessons.forEach((l, i) => lines.push(`${i + 1}. ${l}`));
    } else {
      lines.push("Hom nay khong co bai hoc moi — Nhi van ap dung " + existing.length + " bai hoc da co.");
    }
    if (result.summary) lines.push(`\n${result.summary}`);
    lines.push(`\n(Xem/xoa bo nho tu hoc: /tuhoc)`);
    await sendMessage(lines.join("\n"));
  }

  return { learned: newLessons.length, total: (await getLessons()).length };
}

module.exports = { runDailySelfLearn, getLessons, saveLessons, formatLessonsBlock };
