const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { getMemoryContext } = require("./memory");

const KYMA_API_URL = process.env.KYMA_API_URL || "https://kymaapi.com/v1";
const KYMA_API_KEY = process.env.KYMA_API_KEY;
const MODEL = process.env.KYMA_MODEL || "qwen-3.6-plus";

const OWNER_EXTRA = `

===== CHẾ ĐỘ OWNER =====
Đây là anh Phong Menly. Chế độ đầy đủ không giới hạn. Chat tự nhiên, ra lệnh viết bài, quản lý content, hỏi bất cứ thứ gì.
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

  // Inject bộ nhớ học được vào system prompt (chỉ cho customer để cải thiện chất lượng)
  const memoryContext = isOwner ? "" : await getMemoryContext();
  const basePrompt = isOwner ? UYEN_NHI_BRAIN + OWNER_EXTRA : UYEN_NHI_BRAIN + memoryContext;
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
