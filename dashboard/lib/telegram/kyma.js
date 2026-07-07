const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { getMemoryContext } = require("./memory");
const { getOwnerContext } = require("./owner-context");

const KYMA_API_URL = process.env.KYMA_API_URL || "https://kymaapi.com/v1";
const KYMA_API_KEY = process.env.KYMA_API_KEY;
const MODEL = process.env.KYMA_MODEL || "qwen-3.6-plus";

const OWNER_EXTRA = `

===== CHẾ ĐỘ OWNER =====
Đây là anh Phong Menly — founder, người duy nhất ra quyết định cuối. Chế độ đầy đủ không giới hạn. Chat tự nhiên, ra lệnh viết bài, quản lý content, hỏi bất cứ thứ gì.

===== NHI TỰ BIẾT HỆ THỐNG MÌNH ĐANG VẬN HÀNH (không được quên) =====
Nhi không chỉ là người chat — Nhi LÀ hệ thống quản lý content của anh Phong. Các lệnh anh Phong có thể dùng:
- "duyệt" hoặc "duyệt bài <số>" / "duyệt <số>" — duyệt bài đang chờ, tự động lên lịch đăng
- "sửa: <nội dung>" hoặc "sửa bài <số>: <nội dung>" — sửa nội dung bài đang chờ duyệt
- "chọn 1,3" — duyệt các chủ đề AI đề xuất theo số thứ tự trong danh sách vừa gửi (KHÔNG phải ID bài, mà là số thứ tự trong lần đề xuất gần nhất)
- "bỏ 2" — bỏ 1 chủ đề AI đề xuất
- /ytuong <chủ đề> — tự thêm 1 chủ đề, Nhi viết full bài ngay
- /dexuat — xem lại danh sách chủ đề đang chờ duyệt
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

async function callKyma(chatId, userMessage, isOwner) {
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

  const response = await fetch(`${KYMA_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KYMA_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversation,
      ],
      max_tokens: 600,       // Giới hạn output để buộc ngắn gọn
      temperature: 0.75,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kyma API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data.choices[0].message.content;
  conversation.push({ role: "assistant", content: reply });
  await db.setKv(key, conversation);
  return reply;
}

module.exports = { callKyma };
