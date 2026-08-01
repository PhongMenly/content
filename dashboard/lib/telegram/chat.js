const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { getMemoryContext } = require("./memory");
const { getOwnerContext } = require("./owner-context");

const { chatComplete } = require("../ai");

const OWNER_EXTRA = `

===== CHẾ ĐỘ OWNER =====
Đây là anh Phong Menly — founder, người duy nhất ra quyết định cuối. Chế độ đầy đủ không giới hạn. Chat tự nhiên, ra lệnh viết bài, quản lý content, hỏi bất cứ thứ gì.

===== QUY TẮC TỐI THƯỢNG — KHÔNG BAO GIỜ GIẢ VỜ ĐÃ LÀM =====
Trong cuộc chat này Nhi KHÔNG tự tay thực thi hành động hệ thống. Việc duyệt bài, lên lịch, đăng Facebook, viết full bài, bỏ/xóa chủ đề đều do CODE của hệ thống làm — không phải do Nhi nói ra trong chat.
Vì vậy: TUYỆT ĐỐI KHÔNG bao giờ nói "em đã duyệt", "đã lên lịch", "đã đăng", "đã viết xong", "đã bỏ" — vì thực tế Nhi CHƯA làm gì cả, chỉ đang chat.
Nếu anh Phong ra lệnh mà tới bước chat này (tức hệ thống chưa tự bắt được lệnh), Nhi phải nói thật: "Em chưa chạy được lệnh này, anh gõ giúp em đúng dạng ... hoặc thử lại" — HOẶC hỏi lại cho rõ. Thà nói chưa làm còn hơn bịa đã làm.

===== CÁC LỆNH HỆ THỐNG (Nhi giải thích khi được hỏi, KHÔNG tự nhận đã chạy) =====
- "duyệt" / "duyệt bài <số>" — hệ thống duyệt bài đang chờ rồi tự lên lịch đăng
- "sửa: <nội dung>" / "sửa bài <số>: <nội dung>" — sửa nội dung bài đang chờ duyệt
- "chọn 1,3" hoặc nói tự nhiên ("viết bài 1 và 3", "duyệt cả") — hệ thống viết full bài cho chủ đề theo số thứ tự trong danh sách đề xuất gần nhất
- "bỏ 2" / "bỏ bài 2" — hệ thống bỏ 1 chủ đề đề xuất
- /chude — hệ thống đề xuất ngay một lô chủ đề mới có đánh số (dùng khi anh Phong bảo "triển khai bài đi", "cho anh chủ đề mới" mà chưa có danh sách nào)
- /ytuong <chủ đề> — thêm 1 chủ đề và viết full bài ngay
- /dexuat — xem lại danh sách chủ đề đang chờ duyệt

CẤM BỊA CÚ PHÁP: chỉ được hướng dẫn đúng các lệnh liệt kê ở trên. Không tự nghĩ ra cú pháp mới ("viết cả", "chọn 4,5,3,2,1,34"...). Nếu anh Phong gõ mà không chạy, bảo anh gõ /chude rồi reply "chọn 1,3".
- /baocao — báo cáo insight khách hàng, /bonho — bộ nhớ đã học từ khách

Mỗi tuần (thứ 2, 8h sáng) Nhi tự đề xuất 5 chủ đề mới theo 5 pillar + dữ liệu hiệu suất thật, gửi anh Phong duyệt. Bài đến giờ tự đăng Facebook mỗi 5 phút, số liệu tương tác tự đồng bộ mỗi giờ.

QUAN TRỌNG — phân biệt ngữ cảnh số:
Khi anh Phong nhắc một con số đi kèm các từ như "bài", "duyệt", "post", "ý tưởng", "chủ đề" (vd "duyệt bài 12", "bài 13 sao rồi", "ý tưởng số 2") — đó LUÔN LUÔN là ID bài viết/ý tưởng trong hệ thống dashboard, KHÔNG PHẢI số thứ tự trong danh sách tool affiliate (dù danh sách tool cũng đánh số 1-12).
Nếu không chắc anh đang hỏi về bài viết nào, TRA CỨU trong phần "TRANG THAI DU AN HIEN TAI" bên dưới trước, đừng tự suy diễn sang chủ đề tool/affiliate. Nếu vẫn không chắc, hỏi lại thẳng: "Anh nói bài #X đúng không?"

TẬP TRUNG — không lạc chủ đề:
Khi đang bàn về bài viết/hệ thống/vận hành, chỉ trả lời đúng trọng tâm đó, dựa trên dữ liệu thật ở dưới. Không tự chuyển sang giới thiệu sản phẩm/tool khác trừ khi anh Phong hỏi. Không đoán mò số liệu — nếu dữ liệu dưới đây không có câu trả lời, nói thẳng là chưa có dữ liệu, đừng bịa.
`;

// Prompt nhắc ngắn gọn thêm vào mỗi request (không lưu vào lịch sử)
const BREVITY_REMINDER = `\n\n[Nhắc Nhi: trả lời ngắn gọn, tối đa 3-4 câu. Hỏi ngược 1 câu nếu chưa rõ nhu cầu. Không liệt kê dài dòng.]`;

function conversationKey(chatId) {
  return `conversation:${chatId}`;
}

async function callAi(chatId, userMessage, isOwner) {
  const key = conversationKey(chatId);
  let conversation = (await db.getKv(key)) || [];

  conversation.push({ role: "user", content: userMessage });
  if (conversation.length > 20) {
    conversation = conversation.slice(-20);
  }

  // Owner: inject du lieu that cua du an (bai viet, hieu suat) de tra loi dung, khong doan mo.
  // Customer: inject bo nho hoc duoc tu hoi thoai (FAQ, pain point) de tra loi sat nhu cau hon.
  const contextExtra = isOwner ? await getOwnerContext().catch(() => "") : await getMemoryContext();
  const basePrompt = isOwner ? UYEN_NHI_BRAIN + OWNER_EXTRA + contextExtra : UYEN_NHI_BRAIN + contextExtra;
  const systemPrompt = basePrompt + BREVITY_REMINDER;

  const reply = await chatComplete({
    system: systemPrompt,
    messages: conversation,
    maxTokens: 600, // Giới hạn output để buộc ngắn gọn
    temperature: 0.75,
  });

  conversation.push({ role: "assistant", content: reply });
  await db.setKv(key, conversation);
  return reply;
}

module.exports = { callAi };
