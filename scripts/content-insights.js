#!/usr/bin/env node
// Doc hieu suat bai viet that (like/comment/share tu Facebook) tu dashboard,
// in ra ban tom tat de dung LAM CAN CU khi viet bai moi (Buoc 0 cua phong-post-writer).
const fs = require("fs");
const path = require("path");

function loadEnv(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(path.join(__dirname, "..", "telegram-bot", ".env"));
const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || env.DASHBOARD_API_URL;
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || env.DASHBOARD_API_TOKEN;

async function main() {
  if (!DASHBOARD_API_URL || !DASHBOARD_API_TOKEN) {
    console.log("Khong tim thay DASHBOARD_API_URL / DASHBOARD_API_TOKEN. Bo qua kiem tra hieu suat.");
    return;
  }

  const res = await fetch(`${DASHBOARD_API_URL}/api/stats/insights`, {
    headers: { Authorization: `Bearer ${DASHBOARD_API_TOKEN}` },
  });
  if (!res.ok) {
    console.log(`Khong lay duoc so lieu hieu suat (HTTP ${res.status}). Viet binh thuong theo brand voice mac dinh.`);
    return;
  }
  const data = await res.json();

  if (!data.enough_data) {
    console.log(data.message + " Viet binh thuong theo brand voice mac dinh, chua co du lieu de uu tien pattern nao.");
    return;
  }

  console.log(`HIEU SUAT NOI DUNG THAT (${data.posted_count} bai da dang, trung binh ${data.baseline_avg_engagement} tuong tac/bai)`);
  console.log("");

  console.log("Pillar theo hieu qua (tuong tac trung binh):");
  data.by_pillar.forEach((g) => console.log(`- ${g.label}: ${g.avg_engagement} tb (${g.count} bai)`));
  console.log("");

  console.log("Nen tang theo hieu qua (tuong tac trung binh):");
  data.by_platform.forEach((g) => console.log(`- ${g.label}: ${g.avg_engagement} tb (${g.count} bai)`));
  console.log("");

  console.log("3 BAI DANG THANG (uu tien lap lai pattern hook/goc nhin nay):");
  data.top_posts.forEach((p, i) => {
    console.log(`${i + 1}. [${p.pillar || "?"} · ${p.platform || "?"} · ${p.total_engagement} tuong tac] ${p.title}`);
    console.log(`   Hook mo dau: ${p.body_snippet.split("\n")[0]}`);
  });
  console.log("");

  console.log("3 BAI DANG YEU NHAT (tranh lap lai pattern nay):");
  data.bottom_posts.forEach((p, i) => {
    console.log(`${i + 1}. [${p.pillar || "?"} · ${p.platform || "?"} · ${p.total_engagement} tuong tac] ${p.title}`);
  });
}

main().catch((err) => {
  console.log("Loi khi kiem tra hieu suat (bo qua, van viet binh thuong):", err.message);
});
