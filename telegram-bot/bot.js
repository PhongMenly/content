require("dotenv").config();
const UYEN_NHI_BRAIN = require("./brain");
const { logConversation, generateReport } = require("./insights");
const { learn, getMemoryContext, getMemoryReport } = require("./memory");
const { checkForNewDrafts, handleReviewReply, checkForPostResults } = require("./review-flow");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const KYMA_API_URL = process.env.KYMA_API_URL || "https://kymaapi.com/v1";
const KYMA_API_KEY = process.env.KYMA_API_KEY;
const MODEL = process.env.KYMA_MODEL || "qwen-3.6-plus";

const OWNER_CHAT_ID = 8481163556;

// Nhóm nội bộ team — bot reply tất cả tin nhắn, không cần tag
const TEAM_GROUP_IDS = [-5282553890]; // KOL AI Team - Phong Menly

const conversations = {};

const OWNER_EXTRA = `

===== CHẾ ĐỘ OWNER =====
Đây là anh Phong Menly. Chế độ đầy đủ không giới hạn. Chat tự nhiên, ra lệnh viết bài, quản lý content, hỏi bất cứ thứ gì.
`;

// Prompt nhắc ngắn gọn thêm vào mỗi request (không lưu vào lịch sử)
const BREVITY_REMINDER = `\n\n[Nhắc Nhi: trả lời ngắn gọn, tối đa 3-4 câu. Hỏi ngược 1 câu nếu chưa rõ nhu cầu. Không liệt kê dài dòng.]`;

async function callKyma(chatId, userMessage, isOwner) {
  if (!conversations[chatId]) conversations[chatId] = [];

  conversations[chatId].push({ role: "user", content: userMessage });
  if (conversations[chatId].length > 20) {
    conversations[chatId] = conversations[chatId].slice(-20);
  }

  // Inject bộ nhớ học được vào system prompt (chỉ cho customer để cải thiện chất lượng)
  const memoryContext = isOwner ? "" : getMemoryContext();
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
        ...conversations[chatId],
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
  conversations[chatId].push({ role: "assistant", content: reply });
  return reply;
}

async function sendMessage(chatId, text) {
  const params = new URLSearchParams({ chat_id: chatId, text });
  const res = await fetch(`${TELEGRAM_URL}/sendMessage?${params}`);
  return res.json();
}

async function sendPhoto(chatId, photoUrl, caption) {
  const res = await fetch(`${TELEGRAM_URL}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.slice(0, 1024) }),
  });
  return res.json();
}

// Kiem tra bai moi can duyet moi 5 phut, gui cho owner qua Telegram
function scheduleReviewCheck() {
  setInterval(async () => {
    try {
      const count = await checkForNewDrafts({
        sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
        sendPhoto: (url, caption) => sendPhoto(OWNER_CHAT_ID, url, caption),
      });
      if (count > 0) console.log(`[Review Check] Da gui ${count} bai moi cho owner`);

      const resultCount = await checkForPostResults({
        sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
      });
      if (resultCount > 0) console.log(`[Review Check] Da bao cao ${resultCount} ket qua dang bai`);
    } catch (err) {
      console.error("[Review Check] Loi:", err.message);
    }
  }, 5 * 60 * 1000);
  console.log("[Review Check] Kiem tra bai moi moi 5 phut");
}

async function sendTyping(chatId) {
  const params = new URLSearchParams({ chat_id: chatId, action: "typing" });
  await fetch(`${TELEGRAM_URL}/sendChatAction?${params}`);
}

async function getUpdates(offset) {
  // allowed_updates bao gồm cả message trong group
  const params = new URLSearchParams({
    offset,
    timeout: 30,
    allowed_updates: JSON.stringify(["message"]),
  });
  const res = await fetch(`${TELEGRAM_URL}/getUpdates?${params}`);
  const data = await res.json();
  return data.result || [];
}

// Gửi insights report cho owner — chạy mỗi ngày lúc 8am
function scheduleDailyReport() {
  const now = new Date();
  const next8am = new Date();
  next8am.setHours(8, 0, 0, 0);
  if (now >= next8am) next8am.setDate(next8am.getDate() + 1);
  const msUntil = next8am - now;

  setTimeout(async () => {
    const report = generateReport();
    await sendMessage(OWNER_CHAT_ID, "BAO CAO INSIGHTS HANG NGAY TU NHI:\n\n" + report);
    console.log("[Daily Report] Sent to owner");
    scheduleDailyReport(); // lặp lại ngày mai
  }, msUntil);

  console.log(`[Daily Report] Scheduled in ${Math.round(msUntil / 3600000)}h`);
}

async function handleMessage(message) {
  const chatId = message.chat.id;           // ID của chat (group ID hoặc private ID)
  const senderId = message.from?.id;        // ID thực của người gửi
  const text = (message.text || "").trim();
  const firstName = message.from?.first_name || "ban";
  const chatType = message.chat.type;

  // Owner = người gửi là Phong Menly, dù nhắn từ DM hay nhóm
  const isOwner = senderId === OWNER_CHAT_ID;
  const isTeamGroup = TEAM_GROUP_IDS.includes(chatId);

  // Reply target = luôn reply đúng chỗ người hỏi (group thì reply trong group)
  const replyTo = chatId;

  const timestamp = new Date().toLocaleTimeString("vi-VN");
  const role = isOwner ? "OWNER" : "CUSTOMER";
  const source = chatType === "private" ? "DM" : "GROUP";
  console.log(`[${timestamp}] [${role}][${source}] ${firstName} (sender:${senderId}): ${text}`);

  // Xử lý tin nhắn từ group
  if (chatType !== "private") {
    const botUsername = "@uyennhiCreator_bot";
    const isTagged = text.includes(botUsername);
    const isCommand = text.startsWith("/");

    if (!isTagged && !isCommand && !isTeamGroup) {
      // Nhóm lạ, không tag bot → chỉ học, không reply
      if (!isOwner) logConversation(chatId, firstName + "(group)", text, "[observed]");
      return;
    }

    if (!isTagged && !isCommand && isTeamGroup && text.trim() === "") return;

    // Xóa tag khỏi text
    const cleanText = text.replace(botUsername, "").trim();
    if (!cleanText && !isCommand) return;

    // Xử lý tiếp với chat type là private để vào flow chính, giữ nguyên chatId group để reply đúng chỗ
    return handleMessage({
      ...message,
      text: cleanText || text,
      chat: { ...message.chat, type: "private" },
      _replyTo: chatId,
    });
  }

  // targetChat: ưu tiên _replyTo (group chat), fallback về chatId (DM)
  const targetChat = message._replyTo || chatId;

  await sendTyping(targetChat);

  // Lệnh /start
  if (text === "/start") {
    await sendMessage(targetChat,
      `Hey ${firstName}! Nhi đây.\n\nMình quản lý content cho anh Phong Menly. Bạn đang cần gì?`
    );
    return;
  }

  if (text === "/baocao" || text === "/insights") {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    await sendMessage(OWNER_CHAT_ID, generateReport());
    return;
  }

  if (text === "/bonho" || text === "/memory") {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    await sendMessage(OWNER_CHAT_ID, getMemoryReport());
    return;
  }

  if (text === "/help") {
    const ownerCmds = isOwner
      ? `/baocao — insights tương tác khách\n/bonho — bộ nhớ AI đã học\n`
      : "";
    await sendMessage(targetChat,
      `Nhắn tự nhiên là được. Hoặc dùng:\n\n` +
      `/viet [chủ đề] — viết bài Facebook\n` +
      `/repurpose — repurpose bài sang 5 platform\n` +
      `/lich — lịch content tuần\n` +
      ownerCmds
    );
    return;
  }

  // Duyet/sua bai qua reply tu nhien (chi owner)
  if (isOwner) {
    try {
      const reviewReply = await handleReviewReply(text);
      if (reviewReply) {
        await sendMessage(targetChat, reviewReply);
        return;
      }
    } catch (err) {
      console.error("[Review Reply] Loi:", err.message);
      await sendMessage(targetChat, "Co loi khi duyet/sua bai: " + err.message);
      return;
    }
  }

  // Tất cả tin nhắn khác qua AI
  try {
    const reply = await callKyma(targetChat, text, isOwner);

    if (!isOwner) {
      logConversation(chatId, firstName, text, reply);
      learn(firstName, text, reply); // Học và lưu vào bộ nhớ
    }

    if (reply.length <= 4096) {
      await sendMessage(targetChat, reply);
    } else {
      let remaining = reply;
      while (remaining.length > 0) {
        let cutAt = Math.min(4000, remaining.length);
        if (remaining.length > 4000) {
          const nl = remaining.lastIndexOf("\n", 4000);
          if (nl > 3000) cutAt = nl;
        }
        await sendMessage(targetChat, remaining.slice(0, cutAt));
        remaining = remaining.slice(cutAt);
        if (remaining.length > 0) await new Promise((r) => setTimeout(r, 600));
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
    await sendMessage(targetChat, "Có lỗi rồi, thử lại sau nha " + firstName + ".");
  }
}

async function main() {
  console.log("====================================");
  console.log(" Uyên Nhi Bot — Phong Menly");
  console.log(`  Model  : ${MODEL}`);
  console.log(`  Mode   : Short replies + Insights`);
  console.log("====================================\n");

  scheduleDailyReport();
  scheduleReviewCheck();

  let offset = 0;
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message?.text) {
          handleMessage(update.message).catch((e) =>
            console.error("Handle error:", e.message)
          );
        }
      }
    } catch (err) {
      console.error("Poll error:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main();
