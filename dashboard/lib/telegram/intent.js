/**
 * Bo hieu lenh noi tu nhien cua anh Phong.
 *
 * Van de goc: truoc day chi co regex cung ("duyet", "duyet 12"). Anh Phong noi
 * "duyet ca", "duyet het di em", "cho len lich luon" -> khong khop regex -> roi
 * xuong cho AI chat, va AI tra loi nhu the DA LAM (bia). Rat nguy hiem.
 *
 * Cach lam dung: AI CHI DOC HIEU y dinh va tra ve JSON. Moi hanh dong that su
 * deu do code thuc thi va bao cao ket qua that. AI khong duoc dong vai da lam.
 */
const { chatComplete } = require("../ai");

// Chi goi AI phan loai khi cau noi co dau hieu la mot menh lenh cong viec.
// Tranh ton token cho moi cau tan gau.
const COMMAND_HINT = /(duyệt|duyet|đăng|dang|lịch|lich|viết|viet|sửa|sua|bỏ|bo|hủy|huy|chọn|chon|ý tưởng|y tuong|bài|bai)/i;

const CLASSIFIER_PROMPT = `Ban la bo phan loai y dinh. Doc cau noi cua nguoi dung va tra ve DUY NHAT mot JSON, khong giai thich, khong markdown.

Cac y dinh hop le:
- {"action":"approve_all"}            — duyet TAT CA bai dang cho duyet (vd: "duyet ca", "duyet het di em", "ok duyet toan bo", "cho len lich het")
- {"action":"approve_one","id":12}    — duyet 1 bai cu the (vd: "duyet bai 12", "bai 12 ok em", "cho dang bai 12")
- {"action":"list_pending"}           — hoi xem dang co bai nao cho duyet / tinh trang kho bai
- {"action":"draft","id":12}          — bao viet full bai cho y tuong so 12
- {"action":"none"}                   — moi thu con lai (tan gau, hoi kien thuc, hoi y kien, cam on...)

Quy tac:
- Khong chac chan -> tra {"action":"none"}. Tha bo sot con hon lam sai.
- Cau chi HOI ma khong RA LENH -> "none" (vd "duyet chua em?", "bai 12 sao roi?").
- Cau noi ve qua khu -> "none" (vd "hoi nay anh duyet roi ma").`;

async function classifyIntent(text) {
  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length > 300 || !COMMAND_HINT.test(trimmed)) return { action: "none" };

  try {
    const raw = await chatComplete({
      system: CLASSIFIER_PROMPT,
      messages: [{ role: "user", content: trimmed }],
      maxTokens: 60,
      temperature: 0,
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { action: "none" };
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed.action === "string" ? parsed : { action: "none" };
  } catch (e) {
    // Phan loai that bai thi coi nhu khong phai lenh — tuyet doi khong doan bua
    return { action: "none" };
  }
}

module.exports = { classifyIntent };
