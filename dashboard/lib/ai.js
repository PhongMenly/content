/**
 * Bo nao AI dung chung cho ca he thong (viet bai, ban tin, tu hoc, bao cao, chat Telegram).
 *
 * Mac dinh dung Google Gemini. Van giu duong quay ve Kyma: dat AI_PROVIDER=kyma.
 * Bien moi truong can co tren Vercel:
 *   GEMINI_API_KEY  — bat buoc
 *   GEMINI_MODEL    — tuy chon, mac dinh gemini-2.5-flash
 *   AI_PROVIDER     — tuy chon, "gemini" (mac dinh) hoac "kyma"
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function provider() {
  return (process.env.AI_PROVIDER || "gemini").toLowerCase();
}

function currentModel() {
  return provider() === "kyma"
    ? process.env.KYMA_MODEL || "qwen-3.6-plus"
    : process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

async function callGemini({ system, messages, maxTokens, temperature }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Thieu GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const body = {
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      // Tat che do "suy nghi" — voi cac tac vu viet noi dung nay no chi lam cham
      // va an het han muc token khien Gemini tra ve rong.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 400)}`);

  const data = await res.json();
  const candidate = (data.candidates || [])[0];
  const text = ((candidate && candidate.content && candidate.content.parts) || [])
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    const reason = (candidate && candidate.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason) || "khong ro";
    throw new Error(`Gemini tra ve rong (ly do: ${reason})`);
  }
  return text;
}

async function callKymaProvider({ system, messages, maxTokens, temperature }) {
  const key = process.env.KYMA_API_KEY;
  if (!key) throw new Error("Thieu KYMA_API_KEY");
  const url = process.env.KYMA_API_URL || "https://kymaapi.com/v1";

  const res = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.KYMA_MODEL || "qwen-3.6-plus",
      messages: system ? [{ role: "system", content: system }, ...messages] : messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) throw new Error(`Kyma API error ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// Google thinh thoang tra 503 (qua tai) hoac 429 (dung qua nhanh). Day la loi tam
// thoi — cho vai giay roi thu lai, thay vi de ca co may tu dong chet ca ngay.
function isTemporary(err) {
  return /\b(429|500|502|503|504)\b/.test(err.message) || /fetch failed|network|timeout/i.test(err.message);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Goi AI mot lan (tu thu lai neu gap loi tam thoi).
 * @param {string} system   — prompt he thong (bo nao/ho so nhan vat)
 * @param {Array}  messages — [{ role: "user" | "assistant", content }]
 */
async function chatComplete({ system, messages, maxTokens = 1200, temperature = 0.8 }) {
  const args = { system, messages, maxTokens, temperature };
  const call = () => (provider() === "kyma" ? callKymaProvider(args) : callGemini(args));

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      if (!isTemporary(err) || attempt === 2) throw err;
      await sleep(2000 * (attempt + 1)); // cho 2s roi 4s
    }
  }
  throw lastErr;
}

module.exports = { chatComplete, currentModel, provider };
