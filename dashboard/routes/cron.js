const express = require("express");
const db = require("../db/client");
const { getPostInsights } = require("../lib/facebook");
const { sendToMakeForPosting } = require("../lib/make");
const { sendMessage, sendPhoto, sendVideo } = require("../lib/telegram/telegram-api");
const { checkForNewDrafts, checkForPostResults } = require("../lib/telegram/review-flow");
const { generateReport } = require("../lib/telegram/insights");
const { runBackup } = require("../lib/backup");
const { proposeTopics } = require("../lib/telegram/topic-flow");

const OWNER_CHAT_ID = 8481163556;

const router = express.Router();

function checkCronAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (header === `Bearer ${process.env.CRON_SECRET}`) return next();
  return res.status(401).json({ error: "Unauthorized cron request" });
}

// Bai qua han dang lau hon nguong nay -> coi la ton dong cu (vd vua khoi phuc
// backup, hoac cron nghi dai), KHONG dang de tranh dang don dap ("lên dồn dập").
// Cadence binh thuong la 5 phut/lan nen bai hop le luon dang trong vong vai phut.
const STALE_OVERDUE_SEC = 2 * 3600;

router.get("/auto-post", checkCronAuth, async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const overdue = (await db.getScheduledPosts({})).filter(
    (p) => p.status === "scheduled" && Number(p.scheduled_time) <= now
  );

  const results = [];

  // Loc bai ton dong qua cu ra khoi hang doi truoc khi dang -> khong bao gio dang don.
  const due = [];
  for (const p of overdue) {
    if (now - Number(p.scheduled_time) > STALE_OVERDUE_SEC) {
      const hours = Math.round((now - Number(p.scheduled_time)) / 3600);
      await db.updatePostStatus(p.id, "archived", {
        note: `Qua han dang ${hours}h -> bo qua de tranh dang don. Len lich lai neu van muon dang.`,
        actor: "system",
      });
      results.push({ id: p.id, status: "skipped_stale", overdueHours: hours });
    } else {
      due.push(p);
    }
  }

  for (const post of due) {
    try {
      // Khoa an toan: den gio dang ma thieu noi dung hoac thieu anh -> KHONG dang
      if (!post.body || !post.body.trim()) {
        await db.updatePostStatus(post.id, "failed", { note: "Chan dang: bai khong co noi dung", actor: "system" });
        results.push({ id: post.id, status: "failed", error: "Bai khong co noi dung" });
        continue;
      }
      if (!post.image_path) {
        await db.updatePostStatus(post.id, "failed", { note: "Chan dang: bai chua co hinh anh", actor: "system" });
        results.push({ id: post.id, status: "failed", error: "Bai chua co hinh anh" });
        continue;
      }
      // Gui sang Make de dang len Facebook Page.
      // QUAN TRONG: Make webhook tra "200 Accepted" NGAY CA KHI scenario dang TAT
      // (no chi xep data vao hang doi, chua chay gi ca). Nen KHONG duoc coi 200 la
      // "da dang thanh cong" — truoc day lam vay khien dashboard bao "Da dang" trong
      // khi fanpage trong tron. Gio chi danh dau "sending", doi Make goi nguoc lai
      // /api/cron/make-callback kem fb_post_id that thi moi chuyen sang "posted".
      await sendToMakeForPosting({ postId: post.id, message: post.body, imageUrl: post.image_path });
      await db.updatePost(post.id, { sent_to_make_at: now });
      await db.updatePostStatus(post.id, "sending", { note: "Da gui sang Make, cho Make xac nhan da dang", actor: "system" });
      results.push({ id: post.id, status: "sending" });
    } catch (err) {
      await db.updatePostStatus(post.id, "failed", { note: err.message, actor: "system" });
      results.push({ id: post.id, status: "failed", error: err.message });
    }
  }

  // Chay luon vong canh gac: bai da gui sang Make qua lau ma khong ai xac nhan
  const stuck = await warnStuckSendingPosts();

  res.json({ processed: results.length, results, stuck });
});

// Make goi ve day sau khi dang xong (hoac khi loi) — day la chieu ve cua luong,
// truoc day khong ton tai nen he thong "dang mu": ban di roi khong biet co len that khong.
// Xac thuc bang CRON_SECRET vi router nay nam ngoai lop dang nhap cua dashboard.
router.post("/make-callback", checkCronAuth, async (req, res) => {
  try {
    const { postId, fbPostId, error } = req.body || {};
    if (!postId) return res.status(400).json({ error: "Thieu postId" });

    const post = await db.getPost(postId);
    if (!post) return res.status(404).json({ error: `Khong tim thay bai #${postId}` });

    if (error) {
      await db.updatePostStatus(post.id, "failed", { note: `Make bao loi khi dang: ${error}`, actor: "make" });
      await sendMessage(OWNER_CHAT_ID, `BAI DANG LOI\n\nBai #${post.id}: ${post.title || post.slug}\nMake bao: ${error}`);
      return res.json({ ok: true, status: "failed" });
    }

    if (!fbPostId) return res.status(400).json({ error: "Thieu fbPostId (va cung khong co error)" });

    await db.updatePost(post.id, { fb_post_id: String(fbPostId), posted_at: Math.floor(Date.now() / 1000) });
    await db.updatePostStatus(post.id, "posted", { note: `Make xac nhan da dang len Facebook (${fbPostId})`, actor: "make" });

    // Chi bam len kenh Telegram cong dong khi da chac chan bai co tren fanpage
    try {
      const { broadcastPostToChannel } = require("../lib/telegram/channel-broadcast");
      await broadcastPostToChannel(await db.getPost(post.id));
    } catch (chErr) {
      console.error("[channel-broadcast] Loi:", chErr.message);
    }

    res.json({ ok: true, status: "posted", fbPostId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bai ket o trang thai "sending" qua lau = Make khong chay (scenario tat, het
// operations, connection Facebook chet...). Chi CANH BAO cho anh Phong, khong tu
// danh "failed" — vi bai co the da len that ma chi thieu buoc goi ve.
const MAKE_CONFIRM_TIMEOUT_SEC = 15 * 60;

async function warnStuckSendingPosts() {
  const now = Math.floor(Date.now() / 1000);
  const sending = (await db.listPosts({ status: "sending" })).filter(
    (p) => now - Number(p.sent_to_make_at || p.updated_at || 0) > MAKE_CONFIRM_TIMEOUT_SEC
  );

  const warned = [];
  for (const post of sending) {
    try {
      // Da canh bao roi thi thoi, tranh spam Telegram moi 5 phut
      const history = await db.getHistoryForPost(post.id);
      if (history.some((h) => h.event_type === "make_no_confirm")) continue;

      await db.logHistory({
        postId: post.id,
        eventType: "make_no_confirm",
        note: `Qua ${MAKE_CONFIRM_TIMEOUT_SEC / 60} phut khong thay Make xac nhan`,
        actor: "system",
      });
      await sendMessage(
        OWNER_CHAT_ID,
        `CANH BAO: MAKE KHONG XAC NHAN\n\n` +
          `Bai #${post.id}: ${post.title || post.slug}\n` +
          `Da gui sang Make hon ${MAKE_CONFIRM_TIMEOUT_SEC / 60} phut ma khong co phan hoi.\n\n` +
          `Anh kiem tra giup: scenario Make con BAT khong, con operations khong, connection Facebook con song khong.\n` +
          `Neu bai that ra da len fanpage thi chi la buoc goi ve dang loi.`
      );
      warned.push(post.id);
    } catch (err) {
      console.error("[make-watchdog] Loi:", err.message);
    }
  }
  return { checked: sending.length, warned };
}

router.get("/sync-metrics", checkCronAuth, async (req, res) => {
  const posted = (await db.listPostedPosts()).filter((p) => p.fb_post_id);

  const results = [];
  for (const post of posted) {
    try {
      const insights = await getPostInsights(post.fb_post_id);
      // fb_post_id cu la photo id -> thay bang post id that de lan sau khoi tra cuu
      if (insights.resolvedPostId && insights.resolvedPostId !== post.fb_post_id) {
        await db.updatePost(post.id, { fb_post_id: insights.resolvedPostId });
      }
      await db.updatePostMetrics(post.id, insights);
      results.push({ id: post.id, ...insights });
    } catch (err) {
      results.push({ id: post.id, error: err.message });
    }
  }

  res.json({ processed: results.length, results });
});

router.get("/telegram-review-check", checkCronAuth, async (req, res) => {
  try {
    const draftsSent = await checkForNewDrafts({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
      sendPhoto: (url, caption) => sendPhoto(OWNER_CHAT_ID, url, caption),
    });
    const resultsSent = await checkForPostResults({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
    });

    // May giu kho bai: kho Uyen Linh tut duoi muc toi thieu -> AI de xuat bu ngay
    let pipeline = null;
    try {
      const { ensureTopicPipeline } = require("../lib/telegram/pipeline-guard");
      pipeline = await ensureTopicPipeline({ sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text) });
    } catch (pErr) {
      console.error("[pipeline-guard] Loi:", pErr.message);
    }

    res.json({ draftsSent, resultsSent, pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/telegram-daily-report", checkCronAuth, async (req, res) => {
  try {
    const report = await generateReport();
    await sendMessage(OWNER_CHAT_ID, "BAO CAO INSIGHTS HANG NGAY TU NHI:\n\n" + report);
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bao cao ket qua cuoi ngay ve Telegram
router.get("/daily-summary", checkCronAuth, async (req, res) => {
  try {
    const { buildDailySummary } = require("../lib/telegram/daily-summary");
    await sendMessage(OWNER_CHAT_ID, await buildDailySummary());
    res.json({ ok: true, sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nhi tu hoc cuoi ngay: rut bai hoc tu hoi thoai + hanh dong, nap vao nao cho ngay mai
router.get("/self-learn", checkCronAuth, async (req, res) => {
  try {
    const { runDailySelfLearn } = require("../lib/telegram/self-learn");
    const result = await runDailySelfLearn({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// De xuat tin cho KENH CONG DONG: lay THANG tu kenh chinh chu (YouTube + X cua
// 6 tool, tin ve 4 AI influencer) -> gui 3 bai cho anh Phong duyet.
// Truoc day route nay goi proposeXPost (search tu khoa chung tren X) — cach do
// cho ra bai cua nguoi la va video hai, anh Phong da chot bo.
router.get("/x-discover", checkCronAuth, async (req, res) => {
  try {
    const { proposeFromSources } = require("../lib/telegram/direct-source");
    const result = await proposeFromSources({
      sendMessage: (t) => sendMessage(OWNER_CHAT_ID, t),
      count: Number(req.query.count) || 3,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ban tin AI hang ngay cho kenh cong dong
router.get("/ai-news-digest", checkCronAuth, async (req, res) => {
  try {
    const { sendDailyDigest } = require("../lib/telegram/news-digest");
    const result = await sendDailyDigest();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// May canh YouTube: co video moi -> Nhi gioi thieu len kenh Telegram cong dong
// Chay tu dong: quet video moi. Them ?videoId=xxx de gui tay 1 video cu the
// (dung khi muon dang lai video cu len kenh), ?videoId=latest de gui video moi nhat.
router.get("/youtube-check", checkCronAuth, async (req, res) => {
  try {
    const { checkNewVideos, sendVideoById, resetBaseline } = require("../lib/telegram/youtube-watch");
    const { videoId, reset } = req.query;
    // ?reset=1 -> dat lai moc tinh tu bay gio: moi video hien co coi nhu cu
    if (reset) return res.json({ ok: true, reset: true, ...(await resetBaseline()) });
    if (videoId) {
      const result = await sendVideoById(videoId === "latest" ? null : videoId);
      return res.json({ ok: true, manual: true, ...result });
    }
    res.json({ ok: true, ...(await checkNewVideos()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/db-backup", checkCronAuth, async (req, res) => {
  try {
    const result = await runBackup();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/generate-topics", checkCronAuth, async (req, res) => {
  try {
    const brandKey = req.query.brandKey || "phong_menly";
    const count = await proposeTopics({
      sendMessage: (text) => sendMessage(OWNER_CHAT_ID, text),
      brandKey,
      count: brandKey === "phong_menly" ? 5 : 3,
    });
    res.json({ ok: true, proposed: count, brandKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
