const db = require("../../db/client");
const UYEN_NHI_BRAIN = require("./brain");
const { getContentInsights } = require("../post-insights");
const { markSentAndShown, formatDraftMessage } = require("./review-flow");

const KYMA_API_URL = process.env.KYMA_API_URL || "https://kymaapi.com/v1";
const KYMA_API_KEY = process.env.KYMA_API_KEY;
const MODEL = process.env.KYMA_MODEL || "qwen-3.6-plus";

const DRAFT_TASK_INSTRUCTION = `

===== NHIEM VU HIEN TAI: VIET 1 BAI FACEBOOK HOAN CHINH =====

Day KHONG PHAI mot cuoc chat. Day la nhiem vu viet noi dung.

TUYET DOI KHONG duoc xuat ra:
- Bat ky nhan de/label nao nhu "Buoc 1", "Hook:", "Outline:", "Pillar:", "CTA:"...
- Markdown dac biet: **, __, dau gach ngang dai —
- Bat ky loi giai thich, ghi chu nao ngoai noi dung bai dang

CHI duoc xuat ra DUY NHAT noi dung bai dang cuoi cung, plain text, san sang copy-paste len Facebook ngay lap tuc.

Cau truc ap dung ngam (khong ghi nhan de ra):
1. Hook — cau dau gay to mo hoac gay soc nhe, dua tren so lieu/trai nghiem that
2. Insight — quan sat tu trai nghiem thuc te
3. Huong dan/quy trinh cu the neu chu de phu hop
4. Goc nhin ca nhan / du doan xu huong
5. CTA tu nhien o cuoi (cau hoi kich thich binh luan, khong ep buoc, khong dung "tha tim nhe")

Do dai 200-500 tu. Cau ngan, xuong dong thuong xuyen de de doc tren mobile. Emoji dung vua phai, khong spam.`;

function formatInsightsContext(insights) {
  if (!insights.enough_data) return "";

  const lines = [
    "\n===== HIEU SUAT NOI DUNG THAT (uu tien ap dung) =====",
    `${insights.posted_count} bai da dang, trung binh ${insights.baseline_avg_engagement} tuong tac/bai.`,
  ];

  if (insights.by_pillar.length) {
    lines.push("Pillar hieu qua nhat: " + insights.by_pillar[0].label + ` (${insights.by_pillar[0].avg_engagement} tb)`);
  }
  if (insights.top_posts.length) {
    lines.push("Bai dang thang gan day (uu tien lap lai pattern hook):");
    insights.top_posts.forEach((p) => lines.push(`- [${p.total_engagement} tuong tac] ${p.body_snippet.split("\n")[0]}`));
  }
  if (insights.bottom_posts.length) {
    lines.push("Bai dang yeu (tranh lap lai pattern nay):");
    insights.bottom_posts.forEach((p) => lines.push(`- [${p.total_engagement} tuong tac] ${p.body_snippet.split("\n")[0]}`));
  }

  return lines.join("\n");
}

async function completeOnce(systemPrompt, userPrompt) {
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
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kyma API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Viet full bai cho 1 topic (status = 'idea') -> chuyen 'ready_for_review' + bao Telegram ngay
async function draftTopic(post, { sendMessage, sendPhoto } = {}) {
  const { getBrandProfile } = require("../brand-profile");
  const insights = await getContentInsights();
  const brandProfile = await getBrandProfile();
  const systemPrompt =
    UYEN_NHI_BRAIN +
    `\n\n===== DINH VI THUONG HIEU (BAT BUOC BAM THEO) =====\n` +
    brandProfile +
    DRAFT_TASK_INSTRUCTION +
    formatInsightsContext(insights);
  const userPrompt =
    `Chu de: ${post.title}\n` +
    `Pillar: ${post.pillar || "tu chon phu hop nhat"}\n` +
    `Goc nhin/angle: ${post.angle || "tu quyet dinh goc nhin phu hop"}\n` +
    `Nen tang: ${post.platform || "Facebook"}\n\n` +
    `Viet full bai dang ngay.`;

  const body = await completeOnce(systemPrompt, userPrompt);

  await db.updatePost(post.id, { body });
  const updated = await db.updatePostStatus(post.id, "ready_for_review", {
    note: "Da viet full bai tu topic",
    actor: "system",
  });

  if (sendMessage) {
    const caption = formatDraftMessage(updated);
    if (updated.image_path && sendPhoto) {
      await sendPhoto(updated.image_path, caption);
    } else {
      await sendMessage(caption);
    }
    await markSentAndShown(updated.id);
  }

  return updated;
}

module.exports = { completeOnce, draftTopic };
