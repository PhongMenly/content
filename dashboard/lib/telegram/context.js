/**
 * PHAN BIET NGU CANH — bai kenh cong dong vs bai fanpage vs chu de.
 *
 * Van de: he thong co 3 kho viec song song, ca 3 deu dung chu "duyet"/"dang" va
 * deu co danh so. Anh Phong go "duyet 2" thi Nhi khong biet la:
 *   - bai so 2 trong lo tin kenh cong dong (Telegram), hay
 *   - bai #2 dang cho duyet len fanpage Uyen Linh, hay
 *   - chu de so 2 cho viet thanh bai.
 * Truoc day Nhi doan bua va tra loi lan lon ("bai so 2 cua Uyen Linh se duoc len
 * lich" trong khi anh dang noi ve lo tin cong dong).
 *
 * Cach lam: liet ke kho nao dang co viec, xem cau noi co chi RO dich khong,
 * neu nhap nhang thi HOI LAI chu khong doan.
 */
const db = require("../../db/client");

const POOLS = {
  cong_dong: "lo tin kenh cong dong (Telegram)",
  fanpage: "bai cho duyet len fanpage Uyen Linh",
  chu_de: "chu de cho viet thanh bai",
};

// Tu ma anh Phong hay dung de chi ro dich.
const TARGET_WORDS = {
  cong_dong: /(cộng đồng|cong dong|kênh|kenh\b|telegram|channel|nhóm|nhom)/i,
  fanpage: /(fanpage|page|facebook|\bfb\b|uyên linh|uyen linh)/i,
  chu_de: /(chủ đề|chu de|ý tưởng|y tuong|đề xuất|de xuat)/i,
};

// Cau co dang ra lenh duyet/dang kem so -> de bi nham giua cac kho.
// Bao gom ca cach noi gon chi bang so ("so 2", "2", "2,3") — do cung la lenh
// va cung nhap nhang y het "duyet 2".
const COMMAND_LIKE = /(duyệt|duyet|đăng|dang|chọn|chon|lấy|lay|bỏ|bo\b|post|số\s*\d|^\s*\d+([,\s/]+\d+)*\s*$)/i;

async function getActiveContexts() {
  const active = {};

  const queue = await db.getKv("x_repost_queue");
  const pending = await db.getKv("x_repost_pending");
  if ((Array.isArray(queue) && queue.length) || pending) {
    active.cong_dong = Array.isArray(queue) && queue.length ? queue.length : 1;
  }

  const posts = await db.listPosts({});
  const forReview = posts.filter((p) => p.status === "ready_for_review");
  if (forReview.length) active.fanpage = forReview.length;

  const topicState = await db.getKv("topic_idea_state");
  if (topicState && topicState.map) {
    let n = 0;
    for (const id of Object.values(topicState.map)) {
      const p = await db.getPost(id);
      if (p && p.status === "idea") n++;
    }
    if (n) active.chu_de = n;
  }

  return active;
}

// Anh Phong co chi ro dich khong? Tra ve ten kho, hoac null.
function explicitTarget(text) {
  const t = String(text || "");
  const hits = Object.keys(TARGET_WORDS).filter((k) => TARGET_WORDS[k].test(t));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Quyet dinh co can hoi lai khong.
 * Tra ve { ask: <chuoi cau hoi> } neu nhap nhang, hoac { target: <kho>|null }.
 */
async function resolveTarget(text) {
  const target = explicitTarget(text);
  if (target) return { target };

  if (!COMMAND_LIKE.test(String(text || ""))) return { target: null };

  const active = await getActiveContexts();
  const keys = Object.keys(active);
  if (keys.length <= 1) return { target: keys[0] || null };

  // Tu 2 kho tro len dang co viec ma cau noi khong chi ro -> HOI, khong doan.
  const lines = keys.map((k, i) => `${i + 1}. ${POOLS[k]} (${active[k]} bai)`);
  return {
    ask:
      `Anh dang noi ve kho nao a? Hien dang co:\n${lines.join("\n")}\n\n` +
      `Anh noi kem cho em biet nhe, vi du "dang bai 2 len cong dong" hoac "duyet bai 2 len page".`,
    active,
  };
}

module.exports = { POOLS, getActiveContexts, explicitTarget, resolveTarget, COMMAND_LIKE };
