const fs = require("fs");
const path = require("path");

const INSIGHTS_FILE = path.join(__dirname, "insights.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(INSIGHTS_FILE, "utf8"));
  } catch {
    return { conversations: [], topics: {}, painPoints: [], questions: [] };
  }
}

function save(data) {
  fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Log mỗi lượt hội thoại của khách (không phải owner)
function logConversation(chatId, firstName, userMessage, botReply) {
  const data = load();

  data.conversations.push({
    time: new Date().toISOString(),
    chatId,
    name: firstName,
    user: userMessage.slice(0, 200),
    bot: botReply.slice(0, 200),
  });

  // Giữ tối đa 500 conversations gần nhất
  if (data.conversations.length > 500) {
    data.conversations = data.conversations.slice(-500);
  }

  // Đếm từ khóa chủ đề phổ biến
  const keywords = [
    "học", "khóa", "workshop", "member", "giá", "bao nhiêu", "đăng ký",
    "affiliate", "kiếm tiền", "ai agent", "vibe coding", "video", "content",
    "tool", "chatgpt", "tiktok", "facebook", "youtube", "bắt đầu", "mới"
  ];
  keywords.forEach((kw) => {
    if (userMessage.toLowerCase().includes(kw)) {
      data.topics[kw] = (data.topics[kw] || 0) + 1;
    }
  });

  // Lưu câu hỏi ngắn của khách để phân tích sau
  if (userMessage.length < 150 && userMessage.includes("?")) {
    data.questions.push({
      time: new Date().toISOString(),
      name: firstName,
      q: userMessage,
    });
    if (data.questions.length > 200) {
      data.questions = data.questions.slice(-200);
    }
  }

  save(data);
}

// Tạo báo cáo insights gửi cho Phong
function generateReport() {
  const data = load();
  const total = data.conversations.length;
  if (total === 0) return "Chưa có dữ liệu khách hàng nào.";

  // Top topics
  const sorted = Object.entries(data.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Unique customers
  const uniqueIds = new Set(data.conversations.map((c) => c.chatId));

  // Recent questions
  const recentQs = data.questions.slice(-5).map((q) => `- ${q.name}: ${q.q}`).join("\n");

  // Conversations today
  const today = new Date().toDateString();
  const todayCount = data.conversations.filter(
    (c) => new Date(c.time).toDateString() === today
  ).length;

  let report =
    `BAO CAO INSIGHTS KHACH HANG\n` +
    `============================\n\n` +
    `Tong luot tuong tac: ${total}\n` +
    `Hom nay: ${todayCount} luot\n` +
    `Khach hang doc nhat: ${uniqueIds.size} nguoi\n\n` +
    `CHU DE KHACH HAY HOI NHAT:\n`;

  sorted.forEach(([kw, count], i) => {
    report += `${i + 1}. "${kw}" — ${count} lan\n`;
  });

  if (recentQs) {
    report += `\nCAU HOI GAN NHAT TU KHACH:\n${recentQs}\n`;
  }

  report += `\nNhi se tiep tuc theo doi va update anh Phong them nha!`;
  return report;
}

module.exports = { logConversation, generateReport };
