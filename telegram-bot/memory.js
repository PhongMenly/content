const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "bot-memory.json");

// ─── Load / Save ────────────────────────────────────────────────────────────

function load() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return {
      faqs: [],           // Câu hỏi thường gặp + câu trả lời tốt nhất
      painPoints: {},     // Nỗi đau khách hay nhắc: { "không biết bắt đầu": 5 }
      intents: {},        // Ý định hay gặp: { "hỏi giá": 12 }
      productInterest: {},// Sản phẩm hay được hỏi: { "workshop": 8 }
      goodAnswers: [],    // Q&A mẫu tốt để học lại
      learnedFacts: [],   // Sự thật / insight học được từ khách
      totalLearned: 0,
      lastUpdated: null,
    };
  }
}

function save(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ─── Học từ 1 lượt hội thoại ────────────────────────────────────────────────

function learn(firstName, userMessage, botReply) {
  const mem = load();
  mem.totalLearned += 1;

  const msg = userMessage.toLowerCase();

  // 1. Nhận diện intent
  const intentMap = {
    "hỏi giá / bao nhiêu":   ["giá", "bao nhiêu", "phí", "cost", "tiền"],
    "muốn học / đăng ký":    ["học", "đăng ký", "tham gia", "join", "mua"],
    "hỏi về affiliate":      ["affiliate", "tiếp thị liên kết", "commission"],
    "hỏi về AI tool":        ["tool", "công cụ", "dùng gì", "app", "phần mềm"],
    "hỏi về vibe coding":    ["vibe coding", "build app", "lovable", "cursor", "code"],
    "hỏi về video AI":       ["video", "tiktok", "reels", "seedance", "gpt image"],
    "hỏi cách kiếm tiền":    ["kiếm tiền", "thu nhập", "passive", "mmo", "làm giàu"],
    "mới bắt đầu / newbie":  ["mới", "bắt đầu", "chưa biết", "newbie", "từ đầu"],
    "hỏi về AI agent":       ["agent", "tự động", "automation", "workflow"],
  };

  for (const [intent, keywords] of Object.entries(intentMap)) {
    if (keywords.some((k) => msg.includes(k))) {
      mem.intents[intent] = (mem.intents[intent] || 0) + 1;
    }
  }

  // 2. Nhận diện nỗi đau (pain points)
  const painMap = {
    "không biết bắt đầu":   ["bắt đầu từ đâu", "chưa biết", "không biết", "mới quá"],
    "không có thời gian":   ["bận", "không có thời gian", "ít thời gian"],
    "không có tiền":        ["không có tiền", "đắt quá", "tốn kém", "rẻ hơn"],
    "không biết code":      ["không biết code", "không code được", "không lập trình"],
    "tool quá nhiều rối":   ["nhiều tool", "rối quá", "không biết dùng gì"],
    "chưa kiếm được tiền":  ["chưa kiếm được", "không ra tiền", "thất bại"],
  };

  for (const [pain, keywords] of Object.entries(painMap)) {
    if (keywords.some((k) => msg.includes(k))) {
      mem.painPoints[pain] = (mem.painPoints[pain] || 0) + 1;
    }
  }

  // 3. Nhận diện sản phẩm được hỏi
  const productMap = {
    "workshop":       ["workshop"],
    "member_vip":     ["member", "vip", "50 usd", "50$"],
    "khoa_hoc":       ["khóa học", "building", "kol ai system"],
    "tu_van":         ["tư vấn", "1:1", "100$"],
    "ban_tin":        ["bản tin", "quà tặng", "miễn phí"],
    "tan_thu":        ["tân thủ", "thành viên mới", "bắt đầu"],
  };

  for (const [product, keywords] of Object.entries(productMap)) {
    if (keywords.some((k) => msg.includes(k))) {
      mem.productInterest[product] = (mem.productInterest[product] || 0) + 1;
    }
  }

  // 4. Lưu câu hỏi hay (ngắn, có dấu ?, chưa từng lưu)
  if (
    userMessage.includes("?") &&
    userMessage.length > 10 &&
    userMessage.length < 200
  ) {
    const existing = mem.faqs.find(
      (f) => similarity(f.question, userMessage) > 0.7
    );
    if (existing) {
      existing.count += 1;
      // Cập nhật câu trả lời nếu reply ngắn hơn (thường là tốt hơn)
      if (botReply.length < existing.bestAnswer.length) {
        existing.bestAnswer = botReply;
      }
    } else {
      mem.faqs.push({
        question: userMessage.slice(0, 200),
        bestAnswer: botReply.slice(0, 500),
        count: 1,
        askedBy: firstName,
        learnedAt: new Date().toISOString(),
      });
    }
    // Giữ tối đa 100 FAQ
    if (mem.faqs.length > 100) {
      mem.faqs = mem.faqs.sort((a, b) => b.count - a.count).slice(0, 100);
    }
  }

  // 5. Lưu Q&A mẫu tốt (reply ngắn gọn, rõ ràng)
  if (
    botReply.length > 20 &&
    botReply.length < 300 &&
    userMessage.length > 5
  ) {
    mem.goodAnswers.push({
      q: userMessage.slice(0, 150),
      a: botReply.slice(0, 300),
      time: new Date().toISOString(),
    });
    if (mem.goodAnswers.length > 200) {
      mem.goodAnswers = mem.goodAnswers.slice(-200);
    }
  }

  save(mem);
}

// ─── Tạo context snippet từ bộ nhớ để inject vào system prompt ──────────────

function getMemoryContext() {
  const mem = load();
  if (mem.totalLearned < 5) return ""; // Chưa đủ dữ liệu

  const lines = ["\n===== BỘ NHỚ HỌC ĐƯỢC TỪ KHÁCH HÀNG =====\n"];

  // Top intents
  const topIntents = Object.entries(mem.intents)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topIntents.length) {
    lines.push("Khách hay hỏi về:");
    topIntents.forEach(([k, v]) => lines.push(`- ${k}: ${v} lần`));
    lines.push("");
  }

  // Top pain points
  const topPains = Object.entries(mem.painPoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  if (topPains.length) {
    lines.push("Nỗi đau khách hay gặp:");
    topPains.forEach(([k, v]) => lines.push(`- ${k}: ${v} lần`));
    lines.push("");
  }

  // Top FAQs (hỏi nhiều lần nhất)
  const topFaqs = mem.faqs
    .filter((f) => f.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (topFaqs.length) {
    lines.push("Câu hỏi thường gặp nhất (Nhi ưu tiên trả lời theo pattern này):");
    topFaqs.forEach((f) => {
      lines.push(`H: ${f.question}`);
      lines.push(`Đ: ${f.bestAnswer.slice(0, 200)}`);
      lines.push("");
    });
  }

  // Sản phẩm được quan tâm nhiều
  const topProducts = Object.entries(mem.productInterest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topProducts.length) {
    lines.push(
      "Sản phẩm được hỏi nhiều nhất: " +
        topProducts.map(([k, v]) => `${k}(${v})`).join(", ")
    );
  }

  lines.push("\nDùng bộ nhớ này để trả lời chính xác hơn, đúng nỗi đau hơn.");

  return lines.join("\n");
}

// ─── Báo cáo memory cho owner ────────────────────────────────────────────────

function getMemoryReport() {
  const mem = load();

  if (mem.totalLearned === 0) {
    return "Nhi chưa học được gì từ khách hàng. Cần thêm tương tác!";
  }

  const topIntents = Object.entries(mem.intents)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const topPains = Object.entries(mem.painPoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topFaqs = mem.faqs
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topProducts = Object.entries(mem.productInterest)
    .sort((a, b) => b[1] - a[1]);

  let report = `BO NHO HOC DUOC — UYEN NHI\n`;
  report += `Tong luot hoc: ${mem.totalLearned}\n`;
  report += `Cap nhat: ${mem.lastUpdated ? mem.lastUpdated.slice(0, 10) : "chua co"}\n\n`;

  if (topIntents.length) {
    report += `KHACH HAY HOI VE:\n`;
    topIntents.forEach(([k, v]) => (report += `- ${k}: ${v} lan\n`));
    report += "\n";
  }

  if (topPains.length) {
    report += `NOI DAU PHO BIEN:\n`;
    topPains.forEach(([k, v]) => (report += `- ${k}: ${v} lan\n`));
    report += "\n";
  }

  if (topProducts.length) {
    report += `SAN PHAM DUOC QUAN TAM:\n`;
    topProducts.forEach(([k, v]) => (report += `- ${k}: ${v} lan\n`));
    report += "\n";
  }

  if (topFaqs.length) {
    report += `CAU HOI HOI NHIEU LAN:\n`;
    topFaqs.forEach((f, i) => {
      report += `${i + 1}. [${f.count}x] ${f.question.slice(0, 80)}\n`;
    });
    report += "\n";
  }

  report += `Nhi se tiep tuc hoc va bao cao anh Phong them nha!`;
  return report;
}

// ─── Utility: độ tương đồng câu đơn giản ────────────────────────────────────

function similarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const common = [...wordsA].filter((w) => wordsB.has(w)).length;
  return common / Math.max(wordsA.size, wordsB.size);
}

module.exports = { learn, getMemoryContext, getMemoryReport };
