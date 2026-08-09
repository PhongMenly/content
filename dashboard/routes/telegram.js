const express = require("express");
const { sendMessage, sendPhoto, sendVideo, sendTyping } = require("../lib/telegram/telegram-api");
const { hasXLink, handleXLink, handleXApproval } = require("../lib/telegram/x-repost");
const { callAi } = require("../lib/telegram/chat");
const { logConversation, generateReport } = require("../lib/telegram/insights");
const { learn, getMemoryReport } = require("../lib/telegram/memory");
const { handleReviewReply } = require("../lib/telegram/review-flow");
const { handleTopicReply, handleTopicNaturalReply, addOwnTopic, listPendingIdeas, proposeOrListTopics } = require("../lib/telegram/topic-flow");

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

  // "trien khai bai di em" / "cho anh chu de moi" -> CODE tu de xuat that va gui
  // danh sach danh so moi. Truoc day khong co nhanh nay nen cau lenh roi xuong lop
  // chat, AI tra loi "da day lenh cho he thong" trong khi thuc te khong chay gi.
  if (intent.action === "propose_topics") {
    // Mac dinh uyen_linh — dung persona cua Facebook Page dang ket noi.
    const brandKey = /phong/i.test(text) ? "phong_menly" : "uyen_linh";
    const r = await proposeOrListTopics({ sendMessage: (t) => sendMessage(targetChat, t), brandKey });
    return (r.proposed
      ? `Da de xuat ${r.proposed} chu de moi cho persona "${brandKey}".`
      : `Dang co ${r.listed} chu de cho san cua persona "${brandKey}".`) +
      ` Reply "chon 1,3" de Nhi viet full bai.`;
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
      ? `/baocao — insights tương tác khách\n/bonho — bộ nhớ AI đã học\n/chude — đề xuất lô chủ đề mới ngay (rồi "chọn 1,3")\n/ytuong <chủ đề> — thêm chủ đề, viết full bài ngay\n/dexuat — xem lại các chủ đề đang chờ duyệt\n/hientrang — xem/thêm ghi chú hiện trạng\n/tuhoc — xem những điều Nhi tự học từ anh (21h tự học mỗi tối)\n`
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

  // /chude [persona] — de xuat lo chu de MOI ngay tai cho (khong cho cron hang tuan).
  // BAT BUOC neu ro persona: Facebook Page dang ket noi la cua Uyen Linh, nen mac
  // dinh la uyen_linh. Truoc day mac dinh phong_menly -> ca lo bai chu de/giong anh
  // Phong nam trong hang doi cua page Uyen Linh, kem ca anh su kien cua anh Phong.
  const chudeMatch = text.match(/^\/(?:chude|dexuatmoi)(?:\s+(.+))?$/i);
  if (chudeMatch) {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    const arg = (chudeMatch[1] || "").trim().toLowerCase();
    const brandKey = /phong/.test(arg) ? "phong_menly" : "uyen_linh";
    try {
      const send = (t) => sendMessage(targetChat, t);
      const r = await proposeOrListTopics({ sendMessage: send, brandKey });
      await send(
        (r.proposed
          ? `Da de xuat ${r.proposed} chu de moi cho persona "${brandKey}".`
          : `Dang co ${r.listed} chu de cho san cua persona "${brandKey}".`) +
          `\nReply "chon 1,3" de Nhi viet full bai.` +
          (brandKey === "uyen_linh" ? `\n(Muon chu de cua anh Phong thi go: /chude phong)` : "")
      );
    } catch (err) {
      console.error("[/chude] Loi:", err.message);
      await sendMessage(targetChat, "Co loi khi de xuat chu de: " + err.message);
    }
    return;
  }

  // /nguon — lay bai THANG tu kenh chinh chu (YouTube + X cua 6 tool, tin AI
  // influencer). Day la luong chinh cho kenh cong dong theo yeu cau anh Phong.
  if (text === "/nguon" || text === "/nguonchinhchu") {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    try {
      const { proposeFromSources } = require("../lib/telegram/direct-source");
      await proposeFromSources({ sendMessage: (t) => sendMessage(targetChat, t), count: 3 });
    } catch (err) {
      console.error("[/nguon] Loi:", err.message);
      await sendMessage(targetChat, "Co loi khi lay tin tu nguon chinh chu: " + err.message);
    }
    return;
  }

  // /baix — tim ngay 1 bai X dung chuyen mon cho kenh cong dong (khong cho cron).
  if (text === "/baix" || text === "/baiX") {
    if (!isOwner) {
      await sendMessage(targetChat, "Lệnh này chỉ dành cho anh Phong thôi nha.");
      return;
    }
    try {
      const { proposeXPosts } = require("../lib/telegram/x-repost");
      await proposeXPosts({
        sendMessage: (t) => sendMessage(targetChat, t),
        sendVideo: (u, c) => sendVideo(targetChat, u, c),
        count: 3,
      });
    } catch (err) {
      console.error("[/baix] Loi:", err.message);
      await sendMessage(targetChat, "Co loi khi tim bai X: " + err.message);
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
      const handlers = {
        sendMessage: (t) => sendMessage(targetChat, t),
        sendPhoto: (url, caption) => sendPhoto(targetChat, url, caption),
      };

      // 0a) Dan link X (Twitter) -> Nhi lay video, viet nhap, gui duyet
      if (hasXLink(text)) {
        await handleXLink(text, {
          sendMessage: (t) => sendMessage(targetChat, t),
          sendVideo: (u, c) => sendVideo(targetChat, u, c),
          sendPhoto: (u, c) => sendPhoto(targetChat, u, c),
        });
        return;
      }
      // 0b) PHAN BIET NGU CANH truoc khi cho bat ky luong nao xu ly.
      // He thong co 3 kho cung dung chu "duyet"/"dang" va cung danh so:
      // lo tin kenh cong dong, bai cho duyet len fanpage, chu de cho viet.
      // Neu tu 2 kho tro len dang co viec ma anh Phong khong chi ro dich thi HOI
      // LAI — truoc day Nhi doan bua nen tra loi lan lon (dang noi ve lo tin cong
      // dong lai bao "bai so 2 cua Uyen Linh se duoc len lich").
      const { resolveTarget } = require("../lib/telegram/context");
      const ctx = await resolveTarget(text);
      if (ctx.ask) {
        await sendMessage(targetChat, ctx.ask);
        return;
      }
      // Anh Phong noi ro dich ("... len cong dong" / "... len page") -> chi cho
      // dung luong do xu ly, cac luong khac khong duoc gianh.
      const allow = (pool) => !ctx.target || ctx.target === pool;

      // Duyet/sua/huy bai cho KENH CONG DONG
      if (allow("cong_dong")) {
        const xReply = await handleXApproval(text, { sendMessage: (t) => sendMessage(targetChat, t) });
        if (xReply) {
          if (xReply.trim()) await sendMessage(targetChat, xReply);
          return;
        }
      }

      // 1) Lenh chon CHU DE dang cu phap cung ("chon 1,3" / "bo 2")
      if (allow("chu_de")) {
        const topicReply = await handleTopicReply(text, handlers);
        if (topicReply) {
          await sendMessage(targetChat, topicReply);
          return;
        }

        // 2) Lenh chon chu de noi TU NHIEN ("duyet ca", "viet bai 1 va 3", "bo so 2").
        // Chay TRUOC luong duyet bai nhap: khi dang co chu de cho, "duyet ca" nghia
        // la chon het chu de, khong phai duyet bai nhap (dung loi truoc day cua anh Phong).
        const topicNatural = await handleTopicNaturalReply(text, handlers);
        if (topicNatural) {
          await sendMessage(targetChat, topicNatural);
          return;
        }
      }

      // 3) Duyet bai len FANPAGE
      if (allow("fanpage")) {
        const reviewReply = await handleReviewReply(text);
        if (reviewReply) {
          await sendMessage(targetChat, reviewReply);
          return;
        }

        // Cu phap cung khong khop -> nho AI hieu y. Anh Phong danh so theo THU TU
        // trong danh sach ("chon 1,2,3") con he thong luu theo ID (#60, #51);
        // truoc day khong hieu nen roi xuong chat va Nhi bat anh go lai cu phap.
        const db2 = require("../db/client");
        const pending = (await db2.listPosts({}))
          .filter((p) => p.status === "ready_for_review")
          .sort((a, b) => b.id - a.id);
        if (pending.length) {
          const { classifyReviewIntent } = require("../lib/telegram/intent");
          const ri = await classifyReviewIntent(text, pending);
          const { approveByIds, rejectByIds } = require("../lib/telegram/review-flow");

          if (ri.action === "approve_all") {
            await sendMessage(targetChat, await approveByIds(pending.map((p) => p.id)));
            return;
          }
          if (ri.action === "approve" && ri.ids && ri.ids.length) {
            await sendMessage(targetChat, await approveByIds(ri.ids));
            return;
          }
          if (ri.action === "reject" && ri.ids && ri.ids.length) {
            await sendMessage(targetChat, await rejectByIds(ri.ids));
            return;
          }
        }
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
