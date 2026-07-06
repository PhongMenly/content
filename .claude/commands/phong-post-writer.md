---
name: phong-post-writer
description: >
  Viết bài đăng mạng xã hội theo phong cách Phong Menly. Dùng khi cần tạo bài
  Facebook, Instagram, LinkedIn, hoặc X (Twitter) về AI, affiliate, vibe coding.
  Tự động áp dụng 4-bước SOP, brand voice, và format đúng từng nền tảng.
license: MIT
version: "2.0.0"
tags: ["content-creation", "facebook", "instagram", "linkedin", "x", "vietnamese", "affiliate", "personal-brand"]
---

# Phong Post Writer

Viết bài chuẩn thương hiệu Phong Menly cho Facebook / Instagram / LinkedIn / X — thực chiến, ngắn gọn, có số liệu, dẫn đến conversion.

## Ngữ cảnh Thương hiệu (tự động áp dụng)

**Người viết:** Phong Menly — KOL AI, Startup Founder, Affiliate Marketer
**Ngôn ngữ:** Tiếng Việt (LinkedIn có thể bilingual Việt-Anh; X có thể full English)
**Nền tảng:** Facebook · Instagram · LinkedIn · X (Twitter)

**Brand Voice bắt buộc:**
- Câu ngắn. Xuống dòng thường xuyên. Dễ đọc trên mobile
- Kể câu chuyện thật — có tên, có số, có thời gian cụ thể
- Giọng: thân thiện như anh em, tự tin nhưng không kiêu ngạo
- Dùng "mình" khi kể chuyện cá nhân, "bạn" khi hướng dẫn
- Emoji linh hoạt — không spam

**TUYỆT ĐỐI KHÔNG dùng:**
- "Trong thời đại công nghệ số"
- "Chìa khóa vàng" / "Cơ hội không thể bỏ lỡ" / "Bức tranh toàn cảnh"
- Giọng "dạy đời" hay áp đặt
- Văn dài, không xuống dòng

## Bước 0 — Kiểm tra hiệu suất thật (bắt buộc, tự động, trước khi viết)

Chạy lệnh sau và đọc kết quả trước khi sang Bước 1:

```
node scripts/content-insights.js
```

Script đọc số liệu like/comment/share thật từ dashboard (chỉ tính khi đã có ít nhất 5 bài đăng có số liệu, nếu chưa đủ sẽ báo và bỏ qua bước này).

Nếu có đủ dữ liệu:
- Pillar/nền tảng nào có tương tác trung bình cao nhất → ưu tiên chọn góc đó nếu chủ đề cho phép, không ép nếu không hợp.
- 3 bài thắng nhất → xem hook mở đầu và cấu trúc, có xu hướng lặp lại nếu hợp với chủ đề mới.
- 3 bài yếu nhất → tránh lặp lại kiểu hook/cấu trúc đó.

Nếu chưa đủ dữ liệu hoặc lệnh lỗi: bỏ qua, viết bình thường theo brand voice mặc định ở dưới. Không báo lỗi này cho người dùng, chỉ áp dụng âm thầm.

## Quy trình 4 bước (tự động)

### Bước 1 — Hook & Angle
Tạo 3 lựa chọn hook theo kiểu:
1. **Hook số liệu:** Bắt đầu bằng số cụ thể gây bất ngờ
2. **Hook thất bại:** Thừa nhận sai lầm cụ thể của mình
3. **Hook counterintuitive:** Đi ngược lại điều mọi người nghĩ

Chọn hook phù hợp với chủ đề, hoặc hỏi người dùng chọn.

### Bước 2 — Outline
Mở — Thân — Kết. Trình bày nhanh bố cục trước khi viết.

### Bước 3 — Drafting
Áp dụng framework PAS (Problem → Agitate → Solve) hoặc câu chuyện cá nhân.

**5 trụ cột nội dung — tự động gắn đúng pillar:**
- 🤖 AI Thực chiến (30%): Tool đang dùng, quy trình, case study
- 💰 Kiếm tiền với AI (25%): Affiliate, MMO, thu nhập thụ động
- ⚙️ Build & Vibe Coding (20%): App AI, demo, behind-the-scenes
- 🧠 Tư duy & Góc nhìn (15%): Insight cá nhân, bài học startup
- 🎬 Video & Content AI (10%): Quy trình tạo video, mẹo nhanh

### Bước 4 — CTA
Đề xuất 2 mẫu CTA:
- **CTA Engagement:** Câu hỏi kích thích bình luận (không dùng "thả tim nhé")
- **CTA Conversion:** Dẫn về sản phẩm/affiliate một cách tự nhiên

## Quy tắc từng nền tảng (bắt buộc áp dụng)

| Nền tảng | Độ dài | Giọng | Link | Hashtag | Đặc biệt |
|----------|--------|-------|------|---------|---------|
| **Facebook** | 200–500 từ | "mình/bạn", thân thiện | Trong post OK | Không cần | Xuống dòng nhiều, community |
| **Instagram** | 50–150 từ caption | Trẻ, emoji nhiều | Bio link only | 5–15 tags | Hook dòng đầu, visual-first |
| **LinkedIn** | 150–400 từ | "tôi", chuyên nghiệp hơn | First comment | 3–5 tags | KHÔNG link trong post body |
| **X** | ≤ 280 ký tự (1 tweet) hoặc thread | Ngắn, punch, bold | Trong tweet OK | 1–2 tags | Hook mạnh, thread = 5–10 tweets |

## Input

```
{
  topic: string           # (bắt buộc) Chủ đề bài viết
  platform: string        # (tùy chọn, mặc định: facebook) "facebook" | "instagram" | "linkedin" | "x" | "all"
  pillar: string          # (tùy chọn) 1 trong 5 pillar
  has_story: string       # (tùy chọn) Câu chuyện/số liệu thật của Phong
  product_cta: string     # (tùy chọn) Sản phẩm/affiliate muốn dẫn về
  hook_style: string      # (tùy chọn) "số liệu" | "thất bại" | "counterintuitive" | "bí quyết"
  length: string          # (tùy chọn) "ngắn" | "chuẩn" | "dài" — tự adapt theo platform
}
```

Khi `platform: "all"` → xuất bài cho cả 4 nền tảng, mỗi bài native format riêng.

## Ví dụ mẫu theo phong cách Phong (học từ đây)

**Ví dụ 1 — Hook thất bại:**
> Agent mình build tuần trước gửi nhầm email cho 47 khách hàng.
> Lỗi mình. Không phải lỗi AI.
> [tiếp tục kể chuyện → bài học → framework → câu hỏi]

**Ví dụ 2 — Hook số liệu:**
> 41.000 người dùng. 135.000 lượt xem trang.
> Tăng hơn 200% so với cùng kỳ năm trước.
> [tiếp tục với insight counterintuitive]

**Ví dụ 3 — Hook bí quyết:**
> Chia sẻ anh em cách kiếm tiền Affiliate Marketing mà không cần hiện mặt.
> [tiếp tục Bước 1-2-3-4 cụ thể]

## Checklist tự kiểm trước khi xuất

- [ ] Câu đầu dừng được ngón tay scroll?
- [ ] Có số liệu hoặc tên cụ thể (không nói chung chung)?
- [ ] Câu đủ ngắn để đọc trên mobile?
- [ ] Có bài học/framework cụ thể?
- [ ] Kết có CTA rõ ràng?
- [ ] Không dùng từ cấm?
- [ ] Người đọc làm theo được ngay?

Nếu bất kỳ điểm nào fail → viết lại trước khi xuất. Không báo checklist cho người dùng.

## Xuất file đăng (bắt buộc — tránh lỗi đăng nhầm workflow nội bộ)

File `.md` trong `posts/` là tài liệu kế hoạch nội bộ, LUÔN chứa đủ 4 bước (Hook Options, Outline, Draft, CTA, Repurpose, Assets) để người dùng duyệt. File này KHÔNG BAO GIỜ được dùng trực tiếp làm nội dung đăng — nếu đăng nguyên file, các nhãn kỹ thuật như "BƯỚC 1", "Pillar:", "Hook 3 (...)" sẽ lộ công khai lên mạng xã hội.

Ngay khi người dùng duyệt nội dung ở Bước 3 (chọn hook + CTA cuối cùng), PHẢI tạo thêm 1 file companion cùng tên, đuôi `.final.txt`, ví dụ:
`posts/002-gpt-image-2-seedance-2-kiem-tien.final.txt`

File `.final.txt` chỉ chứa DUY NHẤT nội dung sẽ hiển thị công khai (bản draft đã chọn + CTA đã chọn), không có bất kỳ nhãn nào như "BƯỚC", "Pillar", "Hook", "Platform", "Outline". Đây mới là file được dùng làm `--text-file` khi đăng qua `facebook-bot/post-cli.js` hoặc bất kỳ kênh tự động nào khác.

## Bước tiếp theo

Sau khi có bài:
- "Repurpose sang TikTok/Reels" → `/phong-tiktok-writer`
- "Tạo carousel từ bài này" → `/phong-carousel-writer`
- "Repurpose sang tất cả nền tảng" → `/phong-repurpose`
- "Lên lịch đăng tuần này" → `/social-media-scheduler`
