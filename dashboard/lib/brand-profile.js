/**
 * Ho so thuong hieu cua Phong — AI tu phan tich tu kenh YouTube cua chinh Phong
 * (chu de, tu khoa, san pham, giong dieu) va luu vao bot_kv de moi lan de xuat
 * chu de / viet bai deu bam theo. Phong co the sua tay ho so nay trong Cai dat.
 */
const db = require("../db/client");

const KV_KEY = "brand_profile";

// Ho so mac dinh (rut tu CLAUDE.md) — dung khi chua phan tich kenh
const DEFAULT_PROFILE = `- Phong Menly: KOL AI / Startup Founder, dung AI THUC CHIEN trong kinh doanh hang ngay. Giong chia se trai nghiem that, khong ly thuyet, khong dao ly.
- Khach hang muc tieu: (1) nguoi lam MMO/affiliate chua thanh cong lon, khong biet code; (2) chu kinh doanh online nho thieu nhan su content; (3) nguoi muon xay thuong hieu ca nhan ve AI. Ho KHONG mua AI — ho mua KET QUA KIEM TIEN tu AI.
- He sinh thai san pham de gan CTA: Workshop 100k, Member VIP KOL AI System 50$, khoa Building KOL AI System, AI Tool AI Influencer 25$/thang, tu van 1:1 100$/gio.
- Tu khoa thuong hieu: Thuc chien, Don gian, Kiem tien, Tu dong hoa, He thong.
- Moi chu de phai cho audience thay ket qua/loi ich cu the (so tien, so gio tiet kiem, so buoc lam theo duoc ngay).`;

async function getBrandProfile() {
  const saved = await db.getKv(KV_KEY);
  return (saved && saved.text) || DEFAULT_PROFILE;
}

async function getBrandProfileMeta() {
  const saved = await db.getKv(KV_KEY);
  return saved || { text: DEFAULT_PROFILE, sourceUrl: null, updatedAt: null, isDefault: true };
}

async function setBrandProfile(text, sourceUrl) {
  await db.setKv(KV_KEY, { text, sourceUrl: sourceUrl || null, updatedAt: new Date().toISOString() });
}

module.exports = { getBrandProfile, getBrandProfileMeta, setBrandProfile, DEFAULT_PROFILE };
