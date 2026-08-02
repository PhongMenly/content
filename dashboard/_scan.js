require("dotenv").config({ path: __dirname + "/.env.local" });
const { searchViralAiVideos, passesKeywordGate, scoreRelevance } = require("./lib/telegram/x-repost");
(async () => {
  const t0 = Date.now();
  let tweets = [];
  try { tweets = await searchViralAiVideos(); }
  catch (e) { console.error("Apify loi:", e.message); process.exit(0); }
  console.log(`Apify tra ve ${tweets.length} bai co video (${((Date.now()-t0)/1000).toFixed(0)}s)`);
  const passed = tweets.filter(passesKeywordGate);
  console.log(`Qua cua 1 (tu khoa): ${passed.length}/${tweets.length}`);
  const top = passed.sort((a,b)=>(b.likeCount||0)-(a.likeCount||0)).slice(0, 10);
  console.log("\nCham diem 10 bai nhieu tim nhat:");
  for (const t of top) {
    const s = await scoreRelevance(t.text || "");
    console.log(`  ${String(s.score).padStart(2)}/10 | ${String(t.likeCount||0).padStart(6)} tim | ${(t.text||"").replace(/\s+/g," ").slice(0,70)}`);
  }
  process.exit(0);
})();
