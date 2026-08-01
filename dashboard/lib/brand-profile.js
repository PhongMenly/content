/**
 * Nhieu ho so thuong hieu/persona (Phong Menly, Uyen Linh...) — moi Page/kenh
 * dung 1 ho so rieng de AI viet dung van phong. Truoc day chi co 1 ho so duy
 * nhat (KV "brand_profile"), gio chuyen sang bang brand_profiles co "key" rieng
 * cho tung persona. "phong_menly" la key mac dinh, giu tuong thich nguoc.
 */
const db = require("../db/client");

const DEFAULT_KEY = "phong_menly";

// Ho so mac dinh (rut tu CLAUDE.md) — dung khi chua phan tich kenh va chua co du lieu nao
const DEFAULT_PROFILE = `- Phong Menly: KOL AI / Startup Founder, dung AI THUC CHIEN trong kinh doanh hang ngay. Giong chia se trai nghiem that, khong ly thuyet, khong dao ly.
- Khach hang muc tieu: (1) nguoi lam MMO/affiliate chua thanh cong lon, khong biet code; (2) chu kinh doanh online nho thieu nhan su content; (3) nguoi muon xay thuong hieu ca nhan ve AI. Ho KHONG mua AI — ho mua KET QUA KIEM TIEN tu AI.
- He sinh thai san pham de gan CTA: Workshop 100k, Member VIP KOL AI System 50$, khoa Building KOL AI System, AI Tool AI Influencer 25$/thang, tu van 1:1 100$/gio.
- Tu khoa thuong hieu: Thuc chien, Don gian, Kiem tien, Tu dong hoa, He thong.
- Moi chu de phai cho audience thay ket qua/loi ich cu the (so tien, so gio tiet kiem, so buoc lam theo duoc ngay).`;

// Migrate 1 lan: neu bang brand_profiles rong nhung KV "brand_profile" cu co du lieu
// (he thong truoc khi co nhieu ho so), chuyen no thanh ho so "phong_menly" dau tien.
let migrated = false;
async function migrateLegacyProfileOnce() {
  if (migrated) return;
  migrated = true;
  const existing = await db.getBrandProfileByKey(DEFAULT_KEY);
  if (existing) return;
  const legacy = await db.getKv("brand_profile");
  if (legacy && legacy.text) {
    await db.upsertBrandProfile({
      key: DEFAULT_KEY,
      name: "Phong Menly",
      text: legacy.text,
      sourceUrl: legacy.sourceUrl,
    });
  }
}

async function listBrandProfiles() {
  await migrateLegacyProfileOnce();
  const rows = await db.listBrandProfiles();
  if (rows.length === 0) {
    // Chua co ho so nao ca — tra ve 1 ho so mac dinh "ao" de UI luon co it nhat 1 lua chon
    return [{ key: DEFAULT_KEY, name: "Phong Menly", text: DEFAULT_PROFILE, source_url: null, updated_at: null, isDefault: true }];
  }
  return rows;
}

async function getBrandProfile(key = DEFAULT_KEY) {
  await migrateLegacyProfileOnce();
  const row = await db.getBrandProfileByKey(key);
  if (row && row.text) return row.text;

  // KHONG duoc lay ho so Phong Menly lam do dung cho persona khac. Truoc day
  // fallback im lang ve DEFAULT_PROFILE: chi can tra ho so Uyen Linh hut mot lan
  // (row thieu, hoac DB loi thoang qua) la AI viet chu de MMO/affiliate cua anh
  // Phong duoi ten Uyen Linh. Tha bao loi va dung han con hon de xuat sai persona.
  if (key !== DEFAULT_KEY) {
    throw new Error(`Chua co ho so thuong hieu cho persona "${key}" — khong the viet bai. Vao Dashboard > Ho so thuong hieu de them.`);
  }
  return DEFAULT_PROFILE;
}

async function getBrandProfileMeta(key = DEFAULT_KEY) {
  await migrateLegacyProfileOnce();
  const row = await db.getBrandProfileByKey(key);
  return row || { key, name: key, text: DEFAULT_PROFILE, source_url: null, updated_at: null, isDefault: true };
}

async function setBrandProfile(key, text, sourceUrl, name) {
  const existing = await db.getBrandProfileByKey(key);
  return db.upsertBrandProfile({
    key,
    name: name || (existing && existing.name) || key,
    text,
    sourceUrl: sourceUrl || null,
  });
}

async function createBrandProfile(key, name) {
  const existing = await db.getBrandProfileByKey(key);
  if (existing) throw new Error(`Ho so voi key "${key}" da ton tai`);
  return db.upsertBrandProfile({ key, name, text: "Chua co du lieu — hay dan noi dung hoac phan tich tu 1 nguon.", sourceUrl: null });
}

async function deleteBrandProfileByKey(key) {
  if (key === DEFAULT_KEY) throw new Error("Khong the xoa ho so mac dinh");
  return db.deleteBrandProfile(key);
}

// Prompt dung chung cho moi nguon phan tich (YouTube, Facebook Page, link bat ky).
// 11 muc — 6 muc goc (dinh vi, chu de, tu khoa, san pham, giong dieu, hook) + 5 muc
// moi giup bai viet AI tao ra bam sat van phong that thay vi chi dung chu de/tu khoa chung chung:
// cau truc/nhip bai, ky thuat gay tuong tac cu the, cum tu dac trung lap lai, cong thuc CTA,
// ty le noi dung theo muc dich.
function buildAnalysisSystemPrompt() {
  return (
    `Ban la chuyen gia phan tich thuong hieu ca nhan va content writer. Nhiem vu: doc noi dung duoc cung cap va rut ra HO SO THUONG HIEU chi tiet cua chu nhan, du de mot AI khac VIET LAI DUNG VAN PHONG GOC — khong chi dung chu de/tu khoa chung chung ma phai bat duoc CACH HANH VAN that.\n` +
    `Xuat ra dang gach dau dong tieng Viet, moi muc 1-3 dong, gom dung 11 muc theo dung thu tu:\n` +
    `- Dinh vi: (nguoi/thuong hieu nay la ai, lam gi, phong cach)\n` +
    `- Chu de chinh: (3-5 chu de hay xuat hien)\n` +
    `- Tu khoa: (5-10 tu khoa xuat hien nhieu)\n` +
    `- San pham/dich vu: (nhung gi dang ban hoac quang ba, neu co)\n` +
    `- Giong dieu: (cach viet, xung ho, cam xuc chu dao)\n` +
    `- Cau truc va nhip bai viet: (bai hieu qua nhat mo dau the nao, trien khai than bai ra sao — ke chuyen/liet ke buoc/dan chung, ket bai the nao; do dai trung binh; cach xuong dong)\n` +
    `- Ky thuat gay tuong tac cu the: (vd: thach thuc niem tin pho bien, cau hoi nguoc cuoi bai, so lieu gay soc, thua nhan that bai ca nhan, so sanh truoc/sau — neu ro ky thuat nao dang dung, khong noi chung chung "thang than")\n` +
    `- Cum tu/khau hieu dac trung lap lai: (nhung cum tu nguyen khoi tao nhan dien thuong hieu, xuat hien nhieu lan — KHAC voi tu khoa roi rac o tren)\n` +
    `- Cong thuc CTA: (cach bai viet KET THUC va dan dat hanh dong — khac voi cong thuc hook mo dau)\n` +
    `- Ty le noi dung theo muc dich: (uoc luong % giao duc/huong dan vs case study/ket qua vs quan diem ca nhan vs ban hang, dua tren cac bai da xem)\n` +
    `- Cong thuc tieu de/hook an khach: (rut tu cac bai/video nhieu tuong tac nhat)\n` +
    `Khong giai thich gi them ngoai 11 muc tren. Neu noi dung qua it de ket luan 1 muc nao do, ghi "Chua du du lieu" cho muc do, dung bia.`
  );
}

// Dem so muc bi "Chua du du lieu" trong ket qua phan tich — neu qua nhieu nghia la
// nguon khong doc duoc gi that su (vd trang dang nhap Facebook ca nhan), KHONG duoc
// luu de ghi de mat ho so tot dang co.
function countEmptySections(profileText) {
  const matches = profileText.match(/ch[uư]a đủ dữ liệu|chua du du lieu/gi);
  return matches ? matches.length : 0;
}

const TOTAL_SECTIONS = 11;
const EMPTY_SECTIONS_THRESHOLD = 6; // >= 6/11 muc rong -> coi nhu phan tich that bai

function isAnalysisTooEmpty(profileText) {
  return countEmptySections(profileText) >= EMPTY_SECTIONS_THRESHOLD;
}

module.exports = {
  DEFAULT_KEY,
  DEFAULT_PROFILE,
  listBrandProfiles,
  getBrandProfile,
  getBrandProfileMeta,
  setBrandProfile,
  createBrandProfile,
  deleteBrandProfileByKey,
  buildAnalysisSystemPrompt,
  isAnalysisTooEmpty,
  countEmptySections,
};
