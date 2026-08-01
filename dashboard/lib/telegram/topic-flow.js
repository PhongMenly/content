const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { completeOnce, draftTopic } = require("./draft");
const { getReferenceChannel, buildReferenceBlock } = require("../reference-channel");
const { getBrandProfile, DEFAULT_KEY } = require("../brand-profile");

const STATE_KEY = "topic_idea_state";

// Moi persona co bo pillar rieng — Phong Menly (AI/affiliate) khac han Uyen Linh
// (cong nghe/lam dep/lifestyle). Persona moi them vao brand-profile nhung chua co
// trong map nay se dung PILLARS mac dinh cua Phong Menly.
const PILLARS_BY_KEY = {
  phong_menly: [
    "AI Thuc chien",
    "Kiem tien voi AI",
    "Build va Vibe Coding",
    "Tu duy va Goc nhin",
    "Video va Content AI",
  ],
  uyen_linh: [
    "Ve dep & Phong cach",
    "Du lich & Khoanh khac",
    "Tam su & Tu tin",
    "Song tu do nhe nhang",
  ],
};

function getPillarsFor(brandKey) {
  return PILLARS_BY_KEY[brandKey] || PILLARS_BY_KEY[DEFAULT_KEY];
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function loadTopicState() {
  return (await db.getKv(STATE_KEY)) || { map: {}, updatedAt: null };
}

async function saveTopicState(map) {
  await db.setKv(STATE_KEY, { map, updatedAt: new Date().toISOString() });
}

function formatIdeaList(ideas, brandKey) {
  const label = brandKey && brandKey !== DEFAULT_KEY ? ` (${brandKey})` : "";
  const lines = [`CHU DE DE XUAT${label} — reply de chon:\n`];
  ideas.forEach((idea, i) => {
    lines.push(`${i + 1}. [${idea.pillar || "?"}] ${idea.title}`);
    if (idea.angle) lines.push(`   Goc nhin: ${idea.angle}`);
  });
  lines.push("");
  lines.push('Reply "chon 1,3" de viet full bai cho chu de so 1 va 3');
  lines.push('Reply "bo 2" de bo chu de so 2');
  return lines.join("\n");
}

async function sendIdeaList(ideas, { sendMessage }, brandKey) {
  const map = {};
  ideas.forEach((idea, i) => { map[i + 1] = idea.id; });
  await saveTopicState(map);
  await sendMessage(formatIdeaList(ideas, brandKey));
}

const KEYWORDS_KEY = "topic_keywords";

function keywordsKvKey(brandKey) {
  // Giu nguyen key KV cu cho Phong Menly (tuong thich nguoc), persona moi dung key rieng.
  return brandKey === DEFAULT_KEY || !brandKey ? KEYWORDS_KEY : `${KEYWORDS_KEY}:${brandKey}`;
}

async function getTopicKeywords(brandKey = DEFAULT_KEY) {
  const saved = await db.getKv(keywordsKvKey(brandKey));
  return (saved && saved.keywords) || [];
}

async function setTopicKeywords(keywords, brandKey = DEFAULT_KEY) {
  await db.setKv(keywordsKvKey(brandKey), { keywords, updatedAt: new Date().toISOString() });
}

// Tu dong de xuat chu de moi cho 1 persona (brandKey).
// 2 che do: co tu khoa dat san -> AI bam theo tu khoa; khong co -> AI tu chu dong theo pillar cua persona do.
async function proposeTopics({ sendMessage, brandKey = DEFAULT_KEY, count = 5 }) {
  const pillars = getPillarsFor(brandKey);
  const recent = (await db.listPosts({}))
    .filter((p) => (p.brand_key || DEFAULT_KEY) === brandKey)
    .slice(0, 25)
    .map((p) => p.title)
    .filter(Boolean);
  const keywords = await getTopicKeywords(brandKey);
  const refChannel = await getReferenceChannel();

  const keywordBlock = keywords.length
    ? `\nCHE DO THEO YEU CAU — da dat TU KHOA dinh huong: ${keywords.join(", ")}.\n` +
      `BAT BUOC: ca ${count} chu de phai xoay quanh cac tu khoa nay (moi chu de bam sat it nhat 1 tu khoa).\n`
    : `\nCHE DO TU CHU DONG — khong co tu khoa dinh huong, tu do de xuat da dang theo cac pillar.\n`;

  const brandProfile = await getBrandProfile(brandKey);
  // Persona khac (vd uyen_linh): KHONG nhoi bo nao Uyen Nhi (chua day dinh vi/san pham
  // Phong Menly) vao prompt — tranh giong Phong lan sang chu de cua persona khac
  const writerPreamble =
    brandKey === DEFAULT_KEY
      ? UYEN_NHI_BRAIN
      : `Ban la chuyen gia chien luoc noi dung. De xuat chu de CHI dua tren ho so nhan vat duoi day. TUYET DOI khong dung dinh vi, san pham hay ten "Phong Menly" — nhan vat nay doc lap.`;
  const systemPrompt =
    writerPreamble +
    `\n\n===== DINH VI THUONG HIEU (BAT BUOC BAM THEO) =====\n` +
    brandProfile +
    `\n\n===== NHIEM VU: DE XUAT CHU DE BAI VIET MOI =====\n` +
    `De xuat dung ${count} chu de bai Facebook moi, moi chu de gom title (ngan, hap dan), pillar (1 trong ${pillars.length}: ${pillars.join(", ")}), va angle (1 dong mo ta goc nhin/huong khai thac).\n` +
    keywordBlock +
    buildReferenceBlock(refChannel) +
    `Tranh trung/giong cac chu de da viet gan day.\n` +
    `Chi tra ve DUY NHAT 1 mang JSON hop le, khong giai thich gi them, dung dinh dang:\n` +
    `[{"title": "...", "pillar": "...", "angle": "..."}, ...]`;

  const userPrompt = recent.length
    ? `Cac chu de da viet gan day (tranh trung):\n${recent.map((t) => `- ${t}`).join("\n")}`
    : "Chua co bai nao truoc do.";

  const raw = await completeOnce(systemPrompt, userPrompt);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Khong parse duoc danh sach chu de tu AI: " + raw.slice(0, 200));

  const ideas = JSON.parse(jsonMatch[0]).slice(0, count);
  const created = [];
  for (const idea of ideas) {
    const slug = `${new Date().toISOString().slice(0, 10)}-${slugify(idea.title)}`;
    const post = await db.createPost({
      slug,
      title: idea.title,
      pillar: idea.pillar,
      angle: idea.angle,
      status: "idea",
      source: brandKey === DEFAULT_KEY ? "ai-weekly" : `ai-daily-${brandKey}`,
      brand_key: brandKey === DEFAULT_KEY ? null : brandKey,
    });
    created.push(post);
  }

  await sendIdeaList(created, { sendMessage }, brandKey);
  return created.length;
}

// Giu ten cu de tuong thich nguoc (cron/Telegram command hien tai dang goi ham nay cho Phong Menly).
async function proposeWeeklyTopics({ sendMessage }) {
  return proposeTopics({ sendMessage, brandKey: DEFAULT_KEY, count: 5 });
}

// Liet ke lai cac y tuong dang cho duyet (lenh /dexuat).
// LOC THEO PERSONA: truoc day khong loc nen y tuong cua Uyen Linh de len map,
// anh Phong go "chon 1,2,3" lai nhay vao chu de cua persona khac (hoac bao khong tim thay).
async function listPendingIdeas({ sendMessage, brandKey = DEFAULT_KEY }) {
  const all = await db.listPosts({ status: "idea" });
  const ideas = all.filter((p) => (p.brand_key || DEFAULT_KEY) === brandKey);
  if (ideas.length === 0) {
    await sendMessage("Hien khong co y tuong nao dang cho duyet.");
    return 0;
  }
  await sendIdeaList(ideas, { sendMessage }, brandKey);
  return ideas.length;
}

// Lay danh sach chu de dang cho de chon; neu KHONG con chu de nao thi tu de xuat
// lo moi ngay tai cho. Dung cho lenh /chude va cho y dinh noi tu nhien
// ("cho anh chu de moi", "trien khai bai di em") — de khong bao gio roi xuong
// lop chat va bi AI tra loi nhu the da lam.
async function proposeOrListTopics({ sendMessage, brandKey = DEFAULT_KEY, count = 5 }) {
  const all = await db.listPosts({ status: "idea" });
  const pending = all.filter((p) => (p.brand_key || DEFAULT_KEY) === brandKey);
  if (pending.length > 0) {
    await sendIdeaList(pending, { sendMessage }, brandKey);
    return { proposed: 0, listed: pending.length };
  }
  const proposed = await proposeTopics({ sendMessage, brandKey, count });
  return { proposed, listed: 0 };
}

// Them 1 chu de tu Phong, viet full ngay khong can duyet y tuong (lenh /ytuong)
async function addOwnTopic(title, { sendMessage, sendPhoto }) {
  const slug = `${new Date().toISOString().slice(0, 10)}-${slugify(title)}`;
  const post = await db.createPost({
    slug,
    title,
    status: "idea",
    source: "phong-telegram",
  });
  return draftTopic(post, { sendMessage, sendPhoto });
}

function parseNumbers(text) {
  return text
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

// Viet full bai cho cac so chu de dang cho. Dung chung cho ca lenh cung va lenh tu nhien.
async function writeTopics(numbers, { sendMessage, sendPhoto }) {
  const state = await loadTopicState();
  const results = [];
  for (const n of numbers) {
    const postId = state.map[n];
    if (!postId) { results.push(`Khong tim thay chu de so ${n}`); continue; }
    const post = await db.getPost(postId);
    if (!post || post.status !== "idea") { results.push(`Chu de so ${n} da xu ly roi`); continue; }
    await draftTopic(post, { sendMessage, sendPhoto });
    results.push(`Da viet full bai cho chu de so ${n} (#${postId}), gui ben tren de duyet`);
  }
  return results.join("\n");
}

// Bo (archive) cac so chu de dang cho.
async function dropTopics(numbers, _handlers) {
  const state = await loadTopicState();
  const results = [];
  for (const n of numbers) {
    const postId = state.map[n];
    if (!postId) { results.push(`Khong tim thay chu de so ${n}`); continue; }
    await db.updatePostStatus(postId, "archived", { note: "Bo qua idea qua Telegram", actor: "phong" });
    results.push(`Da bo chu de so ${n}`);
  }
  return results.join("\n");
}

// Cac so chu de van dang cho (post con la "idea"). Rong -> khong co gi de chon.
async function getPendingTopicNumbers() {
  const state = await loadTopicState();
  const nums = [];
  for (const [n, postId] of Object.entries(state.map || {})) {
    const post = await db.getPost(postId);
    if (post && post.status === "idea") nums.push(parseInt(n, 10));
  }
  return nums.sort((a, b) => a - b);
}

// Xu ly reply "chon 1,3" hoac "bo 2" (cu phap cung). Tra ve null neu khong khop.
async function handleTopicReply(text, handlers) {
  const trimmed = text.trim();
  const chonMatch = trimmed.match(/^chọn\s+([\d,\s]+)$/i) || trimmed.match(/^chon\s+([\d,\s]+)$/i);
  const boMatch = trimmed.match(/^bỏ\s+([\d,\s]+)$/i) || trimmed.match(/^bo\s+([\d,\s]+)$/i);
  if (!chonMatch && !boMatch) return null;

  const numbers = parseNumbers((chonMatch || boMatch)[1]);
  if (numbers.length === 0) return null;
  return chonMatch ? writeTopics(numbers, handlers) : dropTopics(numbers, handlers);
}

// Hieu lenh chon/bo chu de bang NGON NGU TU NHIEN ("duyet ca", "viet bai 1 va 3",
// "bo so 2"). Chi chay khi dang co chu de cho -> tranh nham voi luong duyet bai nhap.
const TOPIC_HINT = /(\d|hết|het|cả|ca|tất|tat|toàn|toan|chọn|chon|viết|viet|làm|lam|bỏ|bo|duyệt|duyet|\bok\b|xong|đồng ý|dong y|hủy|huy|xóa|xoa)/i;

async function handleTopicNaturalReply(text, handlers) {
  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length > 200 || !TOPIC_HINT.test(trimmed)) return null;
  const pending = await getPendingTopicNumbers();
  if (!pending.length) return null;

  const { classifyTopicIntent } = require("./intent");
  const intent = await classifyTopicIntent(trimmed, pending);

  if (intent.action === "select_all") return writeTopics(pending, handlers);
  if (intent.action === "select" && Array.isArray(intent.numbers)) {
    const ns = intent.numbers.filter((n) => pending.includes(n));
    if (ns.length) return writeTopics(ns, handlers);
  }
  if (intent.action === "reject" && Array.isArray(intent.numbers)) {
    const ns = intent.numbers.filter((n) => pending.includes(n));
    if (ns.length) return dropTopics(ns, handlers);
  }
  return null;
}

module.exports = {
  proposeTopics,
  proposeWeeklyTopics,
  listPendingIdeas,
  proposeOrListTopics,
  addOwnTopic,
  handleTopicReply,
  handleTopicNaturalReply,
  getPendingTopicNumbers,
  getTopicKeywords,
  setTopicKeywords,
};
