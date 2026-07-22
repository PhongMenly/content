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
    : modelChain()[0];
}

// Ban mien phi cua Google gioi han SO LUOT MOI NGAY cho TUNG MODEL rieng biet.
// Het han muc model chinh -> tu chuyen sang model du phong (moi model mot han muc
// rieng) de he thong khong chet ca ngay. Doi thu tu qua GEMINI_MODEL (ngan cach
// bang dau phay) neu muon.
const DEFAULT_MODEL_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
];

function modelChain() {
  const configured = (process.env.GEMINI_MODEL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!configured.length) return DEFAULT_MODEL_CHAIN;
  // Model cau hinh dung dau, roi den cac model du phong con lai
  return [...configured, ...DEFAULT_MODEL_CHAIN.filter((m) => !configured.includes(m))];
}

async function callGeminiChain(args) {
  const chain = modelChain();
  let lastErr;
  for (const model of chain) {
    try {
      return await callGemini({ ...args, model });
    } catch (err) {
      lastErr = err;
      // Het han muc ngay / model khong dung duoc -> thu model tiep theo.
      // Loi khac (sai key, mat mang) thi bao ngay, khong thu vo ich.
      if (!/\b(429|404)\b/.test(err.message)) throw err;
    }
  }
  throw new Error(`Tat ca model Gemini deu khong dung duoc. Loi cuoi: ${lastErr && lastErr.message}`);
}

async function callGemini({ system, messages, maxTokens, temperature, model }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Thieu GEMINI_API_KEY");
  if (!model) model = modelChain()[0];

  const buildBody = (withThinkingOff) => {
    const body = {
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
    // Tat che do "suy nghi" — voi cac tac vu viet noi dung nay no chi lam cham va
    // an het han muc token khien Gemini tra ve rong. Mot so model doi moi (3.6+)
    // bat buoc phai suy nghi va tu choi tham so nay -> tu goi lai khong kem.
    if (withThinkingOff) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return body;
  };

  const send = (withThinkingOff) =>
    fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(buildBody(withThinkingOff)),
    });

  let res = await send(true);
  if (res.status === 400) {
    // Model khong chap nhan tat suy nghi -> goi lai, va noi rong han muc token
    // de phan suy nghi khong an het phan tra loi.
    maxTokens = Math.max(maxTokens * 4, 2000);
    res = await send(false);
  }

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
  const call = () => (provider() === "kyma" ? callKymaProvider(args) : callGeminiChain(args));

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
