/**
 * Bo hieu lenh noi tu nhien cua anh Phong.
 *
 * Van de goc: truoc day chi co regex cung ("duyet", "duyet 12"). Anh Phong noi
 * "duyet ca", "duyet het di em", "cho len lich luon" -> khong khop regex -> roi
 * xuong cho AI chat, va AI tra loi nhu the DA LAM (bia). Rat nguy hiem.
 *
 * Cach lam dung: AI CHI DOC HIEU y dinh va tra ve JSON. Moi hanh dong that su
 * deu do code thuc thi va bao cao ket qua that. AI khong duoc dong vai da lam.
 */
const { chatComplete } = require("../ai");

// Chi goi AI phan loai khi cau noi co dau hieu la mot menh lenh cong viec.
// Tranh ton token cho moi cau tan gau.
const COMMAND_HINT = /(duyệt|duyet|đăng|dang|lịch|lich|viết|viet|sửa|sua|bỏ|bo|hủy|huy|chọn|chon|ý tưởng|y tuong|bài|bai|chủ đề|chu de|triển khai|trien khai|đề xuất|de xuat)/i;

const CLASSIFIER_PROMPT = `Ban la bo phan loai y dinh. Doc cau noi cua nguoi dung va tra ve DUY NHAT mot JSON, khong giai thich, khong markdown.

Cac y dinh hop le:
- {"action":"approve_all"}            — duyet TAT CA bai dang cho duyet (vd: "duyet ca", "duyet het di em", "ok duyet toan bo", "cho len lich het")
- {"action":"approve_one","id":12}    — duyet 1 bai cu the (vd: "duyet bai 12", "bai 12 ok em", "cho dang bai 12")
- {"action":"list_pending"}           — hoi xem dang co bai nao cho duyet / tinh trang kho bai
- {"action":"draft","id":12}          — bao viet full bai cho y tuong so 12
- {"action":"propose_topics"}         — yeu cau de xuat/trien khai chu de bai viet MOI, khong neu so cu the (vd: "cho anh chu de moi", "trien khai bai di em", "viet bai di", "len y tuong di", "de xuat chu de", "sao chua thay viet gi")
- {"action":"none"}                   — moi thu con lai (tan gau, hoi kien thuc, hoi y kien, cam on...)

Quy tac:
- Khong chac chan -> tra {"action":"none"}. Tha bo sot con hon lam sai.
- Cau chi HOI ma khong RA LENH -> "none" (vd "duyet chua em?", "bai 12 sao roi?").
- Cau noi ve qua khu -> "none" (vd "hoi nay anh duyet roi ma").`;

async function classifyIntent(text) {
  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length > 300 || !COMMAND_HINT.test(trimmed)) return { action: "none" };

  try {
    const raw = await chatComplete({
      system: CLASSIFIER_PROMPT,
      messages: [{ role: "user", content: trimmed }],
      maxTokens: 60,
      temperature: 0,
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { action: "none" };
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed.action === "string" ? parsed : { action: "none" };
  } catch (e) {
    // Phan loai that bai thi coi nhu khong phai lenh — tuyet doi khong doan bua
    return { action: "none" };
  }
}

// Phan loai y dinh khi anh Phong tra loi mot DANH SACH CHU DE do Nhi de xuat.
// Khac voi classifyIntent (duyet bai nhap) — day la chon chu de de VIET.
// `numbers` la cac so chu de dang co that (vd [1,2,3,4,5]).
async function classifyTopicIntent(text, numbers) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { action: "none" };

  const prompt = `Nguoi dung vua duoc de xuat cac chu de bai viet, danh so: ${numbers.join(", ")}.
Doc cau tra loi va tra ve DUY NHAT mot JSON, khong giai thich, khong markdown.

Y dinh hop le:
- {"action":"select_all"}              — chon/viet/duyet TAT CA chu de (vd: "duyet ca", "viet het di", "chon tat ca", "lam het", "ok het", "duyet toan bo")
- {"action":"select","numbers":[1,3]}  — chon mot so chu de cu the de viet (vd: "viet bai 1 va 3", "lam so 1,3", "chon cai 2", "so 1 di em")
- {"action":"reject","numbers":[2]}    — bo/huy mot so chu de (vd: "bo bai 2", "khong thich so 2", "xoa 2", "huy 4")
- {"action":"none"}                    — khong ro / cau hoi / tan gau

Quy tac:
- Chi lay cac so nam trong danh sach ${numbers.join(", ")}. Bo qua so ngoai danh sach.
- Khong chac chan -> {"action":"none"}. Tha bo sot con hon lam sai.
- Cau chi HOI ("chon may cai?", "so 1 la gi?") -> "none".`;

  try {
    const raw = await chatComplete({
      system: prompt,
      messages: [{ role: "user", content: trimmed }],
      maxTokens: 60,
      temperature: 0,
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { action: "none" };
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed.action !== "string") return { action: "none" };
    if (Array.isArray(parsed.numbers)) {
      parsed.numbers = parsed.numbers.map(Number).filter((n) => numbers.includes(n));
    }
    return parsed;
  } catch (e) {
    return { action: "none" };
  }
}

// Hieu y anh Phong khi dang co MOT LO BAI danh so cho dang len kenh cong dong.
// Anh Phong noi tu nhien ("duyet 2/3", "so 2", "lay cai dau", "het di em") chu
// khong go dung chuoi "dang 1,3" — truoc day khong khop la roi xuong lop chat
// va Nhi bia ra cu phap khong ton tai.
async function classifyQueueIntent(text, numbers) {
  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length > 200) return { action: "none" };

  const prompt = `Anh Phong vua duoc gui ${numbers.length} bai viet danh so ${numbers.join(", ")} de chon dang len kenh cong dong.
Doc cau tra loi cua anh va tra ve DUY NHAT mot JSON, khong giai thich, khong markdown.

Y dinh hop le:
- {"action":"publish","numbers":[2,3]}  — dang cac bai co so do (vd: "duyet 2,3", "duyet 2/3", "so 2", "lay bai 2 va 3", "cai dau tien", "bai cuoi")
- {"action":"publish_all"}              — dang het (vd: "dang het", "duyet ca", "lay tat ca", "ok het")
- {"action":"reject"}                   — khong dang bai nao (vd: "bo", "huy", "khong dang", "bo het di")
- {"action":"resend"}                   — muon xem lai cac bai (vd: "gui lai", "cho xem lai", "xem lai di")
- {"action":"ambiguous","numbers":[2,3]} — co ve muon dang nhung KHONG chac la nhung so nao
- {"action":"none"}                     — khong lien quan den lo bai nay (hoi chuyen khac, tan gau)

Quy tac:
- Chi lay so nam trong ${numbers.join(", ")}. Bo so ngoai danh sach.
- "2/3" thuong nghia la bai so 2 VA bai so 3, khong phai "2 trong 3".
- "cai dau"/"bai dau" = ${numbers[0]}; "cai cuoi"/"bai cuoi" = ${numbers[numbers.length - 1]}.
- Cau chi HOI ("bai 2 noi gi?", "may bai?") -> "none".
- Neu hieu duoc ro rang thi tra publish. Chi dung "ambiguous" khi that su khong doan duoc so nao.`;

  try {
    const raw = await chatComplete({
      system: prompt,
      messages: [{ role: "user", content: trimmed }],
      maxTokens: 80,
      temperature: 0,
    });
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { action: "none" };
    const p = JSON.parse(m[0]);
    if (!p || typeof p.action !== "string") return { action: "none" };
    if (Array.isArray(p.numbers)) {
      p.numbers = p.numbers.map(Number).filter((n) => numbers.includes(n));
    }
    return p;
  } catch (e) {
    return { action: "none" };
  }
}

// Hieu y anh Phong khi dang co BAI CHO DUYET LEN FANPAGE.
// Truoc day luong nay chi hieu dung "duyet <so>" — anh Phong go "chon 1,2,3 dang
// page" la truot, roi xuong lop chat va Nhi lai bat anh go dung cu phap.
// Kho o cho anh Phong danh so theo THU TU trong danh sach (1,2,3) con he thong
// luu theo ID (#60, #51) — phai hieu ca hai kieu.
async function classifyReviewIntent(text, pending) {
  const trimmed = (text || "").trim();
  if (!trimmed || trimmed.length > 300 || !pending.length) return { action: "none" };

  const list = pending.map((p, i) => `${i + 1}. #${p.id} — ${String(p.title || "").slice(0, 60)}`).join("\n");
  const prompt = `Anh Phong dang co ${pending.length} bai cho duyet de len lich dang Fanpage:
${list}

Doc cau noi cua anh va tra ve DUY NHAT mot JSON, khong giai thich, khong markdown.

Y dinh hop le:
- {"action":"approve","ids":[60,51]}  — duyet cac bai do. ids la ID THAT (so sau dau #).
- {"action":"approve_all"}            — duyet het (vd: "duyet ca", "duyet het", "ok tat ca", "len lich het")
- {"action":"reject","ids":[60]}      — bo/huy bai do
- {"action":"none"}                   — khong phai lenh duyet bai fanpage

Quy tac QUAN TRONG:
- Anh Phong co the goi theo THU TU trong danh sach ("chon 1,2,3" = bai thu 1, 2, 3)
  hoac theo ID ("duyet 60" = bai #60). Hay suy ra ID THAT roi dien vao "ids".
- Neu so anh noi vuot qua ${pending.length} bai dang co thi bo so do di, van lay cac so hop le.
- "bai dau" = bai thu 1; "bai cuoi" = bai thu ${pending.length}.
- Cau chi HOI ("bai 60 sao roi?", "con may bai?") -> "none".
- Khong chac chan -> "none".`;

  try {
    const raw = await chatComplete({
      system: prompt,
      messages: [{ role: "user", content: trimmed }],
      maxTokens: 100,
      temperature: 0,
    });
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { action: "none" };
    const p = JSON.parse(m[0]);
    if (!p || typeof p.action !== "string") return { action: "none" };
    const valid = new Set(pending.map((x) => x.id));
    if (Array.isArray(p.ids)) p.ids = p.ids.map(Number).filter((id) => valid.has(id));
    return p;
  } catch (e) {
    return { action: "none" };
  }
}

module.exports = { classifyIntent, classifyTopicIntent, classifyQueueIntent, classifyReviewIntent };
