const express = require("express");
const { sendMessage, sendPhoto, sendTyping } = require("../lib/telegram/telegram-api");
const { callAi } = require("../lib/telegram/chat");
const { logConversation, generateReport } = require("../lib/telegram/insights");
const { learn, getMemoryReport } = require("../lib/telegram/memory");
const { handleReviewReply } = require("../lib/telegram/review-flow");
const { handleTopicReply, addOwnTopic, listPendingIdeas } = require("../lib/telegram/topic-flow");

const router = express.Router();

const OWNER_CHAT_ID = 8481163556;

// Thuc thi lenh noi tu nhien. Tra ve chuoi ket qua THAT (da lam gi, ket qua sao),
// hoac null neu khong phai lenh -> de AI tra loi nhu binh thuong.
async function runIntent(text, targetChat) {
  const { classifyIntent } = require("../lib/telegram/intent");
  const db = require("../db/client");
  const intent = await classifyIntent(text);

  if (intent.action === "approve_all") {
    return handleReviewReply("duyet ca");
  }

  if (intent.action === "approve_one" && intent.id) {
    return handleReviewReply(`duyet ${intent.id}`);
  }

  if (intent.action === "list_pending") {
    const posts = await db.listPosts({});
    const pending = posts.filter((p) => p.status === "ready_for_review");
    const scheduled = posts.filter((p) => p.status === "scheduled");
    const ideas = posts.filter((p) => p.status === "idea");
    const lines = [
      `Cho anh duyet: ${pending.length} bai${pending.length ? " (" + pending.map((p) => "#" + p.id).join(", ") + ")" : ""}`,
      `Da len lich: ${scheduled.length} bai`,
      `Y tuong chua viet: ${ideas.length}`,
    ];
    return lines.join("\n");
  }

  if (intent.action === "draft" && intent.id) {
    const post = await db.getPost(intent.id);
    if (!post) return `Khong tim thay bai #${intent.id}.`;
    if (post.status !== "idea") return `Bai #${intent.id} khong phai y tuong (dang la: ${post.status}), khong viet lai duoc.`;
    const { draftTopic } = require("../lib/telegram/draft");
    await draftTopic(post, {
      sendMessage: (t) => sendMessage(targetChat, t),
      sendPhoto: (url, caption) => sendPhoto(targetChat, url, caption),
    });
    return null; // draftTopic da tu gui ban thao roi
  }

  return null;
}

// Nhóm nội bộ team — bot reply tất cả tin nhắn, không cần tag
const TEAM_GROUP_IDS = [-5282553890]; // KOL AI Team - Phong Menly

async function handleMessage(message) {
  const chatId = message.chat.id;           // ID của chat (group ID hoặc private ID)
  const senderId = message.from?.id;        // ID thực của người gửi
  const text = (message.text || "").trim();
  const firstName = message.from?.first_name || "ban";
  const chatType = message.chat.type;

  // Owner = người gửi là Phong Menly, dù nhắn từ DM hay nhóm
  const isOwner = senderId === OWNER_CHAT_ID;
  const isTeamGroup = TEAM_GROUP_IDS.includes(chatId);

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
      if (!isOwner) await logConversation(chatId, firstName + "(group)", text, "[observed]");
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
    await sendMessage(OWNER_CHAT_ID, await generateReport());
    return;
  }

  if (text === "/bonho" || text === "/memory") {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    await sendMessage(OWNER_CHAT_ID, await getMemoryReport());
    return;
  }

  if (text === "/help") {
    const ownerCmds = isOwner
      ? `/baocao — insights tương tác khách\n/bonho — bộ nhớ AI đã học\n/ytuong <chủ đề> — thêm chủ đề, viết full bài ngay\n/dexuat — xem lại các chủ đề đang chờ duyệt\n/hientrang — xem/thêm ghi chú hiện trạng\n/tuhoc — xem những điều Nhi tự học từ anh (21h tự học mỗi tối)\n`
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

  const tuhocMatch = text.match(/^\/tuhoc(?:\s+(xoa|xóa))?$/i);
  if (tuhocMatch) {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    const { getLessons, saveLessons } = require("../lib/telegram/self-learn");
    try {
      if (tuhocMatch[1]) {
        await saveLessons([]);
        await sendMessage(targetChat, "Da xoa het bo nho tu hoc. Nhi se hoc lai tu dau.");
      } else {
        const lessons = await getLessons();
        await sendMessage(targetChat, lessons.length
          ? "NHUNG DIEU NHI DA TU HOC:\n" + lessons.map((l, i) => `${i + 1}. ${l.text || l}${l.learnedAt ? ` (${l.learnedAt})` : ""}`).join("\n")
          : "Nhi chua tu hoc duoc gi — moi 21h toi Nhi se tu rut bai hoc tu hoi thoai trong ngay.");
      }
    } catch (err) {
      await sendMessage(targetChat, "Loi bo nho tu hoc: " + err.message);
    }
    return;
  }

  const hientrangMatch = text.match(/^\/hientrang(?:\s+([\s\S]+))?$/i);
  if (hientrangMatch) {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    const { getSystemNotes, appendSystemNote, clearSystemNotes } = require("../lib/telegram/system-notes");
    const arg = (hientrangMatch[1] || "").trim();
    try {
      if (!arg) {
        const notes = await getSystemNotes();
        await sendMessage(targetChat, notes.length
          ? "GHI CHU HIEN TRANG:\n" + notes.map((n) => "- " + n).join("\n")
          : "Chua co ghi chu hien trang nao. Them bang: /hientrang <noi dung>");
      } else if (/^(xoa|xóa)$/i.test(arg)) {
        await clearSystemNotes();
        await sendMessage(targetChat, "Da xoa het ghi chu hien trang.");
      } else {
        await appendSystemNote(arg);
        await sendMessage(targetChat, "Da ghi nho. Tu gio Nhi se tra loi dua tren hien trang nay.");
      }
    } catch (err) {
      await sendMessage(targetChat, "Loi ghi chu: " + err.message);
    }
    return;
  }

  if (text === "/dexuat") {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    try {
      await listPendingIdeas({ sendMessage: (t) => sendMessage(targetChat, t) });
    } catch (err) {
      console.error("[/dexuat] Loi:", err.message);
      await sendMessage(targetChat, "Co loi khi lay danh sach y tuong: " + err.message);
    }
    return;
  }

  const ytuongMatch = text.match(/^\/ytuong\s+(.+)$/is);
  if (text === "/ytuong" || ytuongMatch) {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    if (!ytuongMatch) {
      await sendMessage(targetChat, 'Dung: "/ytuong <chu de ban muon viet>"');
      return;
    }
    try {
      await addOwnTopic(ytuongMatch[1].trim(), {
        sendMessage: (t) => sendMessage(targetChat, t),
        sendPhoto: (url, caption) => sendPhoto(targetChat, url, caption),
      });
    } catch (err) {
      console.error("[/ytuong] Loi:", err.message);
      await sendMessage(targetChat, "Co loi khi viet bai: " + err.message);
    }
    return;
  }

  // Duyet/sua chu de hoac bai qua reply tu nhien (chi owner)
  if (isOwner) {
    try {
      const topicReply = await handleTopicReply(text, {
        sendMessage: (t) => sendMessage(targetChat, t),
        sendPhoto: (url, caption) => sendPhoto(targetChat, url, caption),
      });
      if (topicReply) {
        await sendMessage(targetChat, topicReply);
        return;
      }

      const reviewReply = await handleReviewReply(text);
      if (reviewReply) {
        await sendMessage(targetChat, reviewReply);
        return;
      }

      // Cach noi tu nhien khong khop regex ("duyet het di em", "cho len lich luon")
      // -> nho AI doc hieu y dinh, roi CODE thuc thi that va bao ket qua that.
      const intentReply = await runIntent(text, targetChat);
      if (intentReply) {
        await sendMessage(targetChat, intentReply);
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
    const reply = await callAi(targetChat, text, isOwner);

    if (!isOwner) {
      await logConversation(chatId, firstName, text, reply);
      await learn(firstName, text, reply); // Học và lưu vào bộ nhớ
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

router.post("/webhook", async (req, res) => {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid secret token" });
  }

  // Serverless: phai xu ly xong roi moi tra response, vi function co the
  // bi dong bang ngay sau khi response duoc gui (khong dam bao code sau do chay tiep).
  try {
    const update = req.body;
    if (update.message?.text) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error("[Telegram Webhook] Loi:", err.message);
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
