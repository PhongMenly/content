const db = require("../db/client");

const TOPVIEW_BASE_URL = "https://api.topview.ai";

async function refreshTopviewCredit() {
  const uid = process.env.TOPVIEW_UID;
  const apiKey = process.env.TOPVIEW_API_KEY;
  if (!uid || !apiKey) {
    throw new Error("Thieu TOPVIEW_UID hoac TOPVIEW_API_KEY trong bien moi truong");
  }

  const res = await fetch(`${TOPVIEW_BASE_URL}/user/credit/detail`, {
    headers: {
      "Topview-Uid": uid,
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const data = await res.json();
  if (String(data.code) !== "200") {
    throw new Error(`Topview API error: ${data.message || JSON.stringify(data)}`);
  }
  const result = data.result || data;

  await db.saveCreditSnapshot({
    provider: "topview",
    balance: result.remainCredit,
    rawResponse: JSON.stringify(result),
  });
  return result;
}

async function getLatestCredits() {
  return {
    topview: await db.getLatestCreditSnapshot("topview"),
    kie_ai: null,
  };
}

module.exports = { refreshTopviewCredit, getLatestCredits };
