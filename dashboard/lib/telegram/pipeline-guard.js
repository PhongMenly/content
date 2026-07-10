/**
 * May giu kho bai Uyen Linh: kho noi dung (y tuong + cho duyet + da len lich)
 * phai luon >= MIN_PIPELINE bai. Tut xuong duoi la AI de xuat bu ngay,
 * khong cho den 8h sang. Co khoa chong spam: toi thieu 3 gio giua 2 lan de xuat.
 */
const db = require("../../db/client");
const { proposeTopics } = require("./topic-flow");

const BRAND_KEY = "uyen_linh";
const MIN_PIPELINE = 6;
const MIN_GAP_HOURS = 3;
const STATE_KEY = "pipeline_guard_state";

const ACTIVE_STATUSES = ["idea", "ready_for_review", "scheduled"];

async function countActivePipeline() {
  const posts = await db.listPosts({});
  return posts.filter(
    (p) => (p.brand_key || "") === BRAND_KEY && ACTIVE_STATUSES.includes(p.status)
  ).length;
}

async function ensureTopicPipeline({ sendMessage }) {
  const current = await countActivePipeline();
  if (current >= MIN_PIPELINE) {
    return { ok: true, current, proposed: 0, reason: "Kho du bai" };
  }

  // Chong spam: khong de xuat lien tuc neu vua chay gan day
  const state = (await db.getKv(STATE_KEY)) || { lastRunAt: 0 };
  const hoursSince = (Date.now() - (state.lastRunAt || 0)) / 3600000;
  if (hoursSince < MIN_GAP_HOURS) {
    return { ok: true, current, proposed: 0, reason: `Vua de xuat ${hoursSince.toFixed(1)}h truoc, cho du ${MIN_GAP_HOURS}h` };
  }

  const need = Math.min(MIN_PIPELINE - current, 5);
  await db.setKv(STATE_KEY, { lastRunAt: Date.now() });

  if (sendMessage) {
    await sendMessage(
      `Kho bai Uyen Linh dang con ${current}/${MIN_PIPELINE} bai — Nhi de xuat bu ${need} chu de moi nha:`
    );
  }
  const proposed = await proposeTopics({ sendMessage, brandKey: BRAND_KEY, count: need });
  return { ok: true, current, proposed };
}

module.exports = { ensureTopicPipeline, countActivePipeline, MIN_PIPELINE };
