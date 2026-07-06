---
name: phong-carousel-writer
description: >
  Tạo nội dung carousel nhiều ảnh theo phong cách Phong Menly cho Facebook/LinkedIn.
  Dùng khi cần viết carousel, bài nhiều slide, infographic content về AI, affiliate,
  vibe coding, hoặc hướng dẫn từng bước. Xuất nội dung từng slide sẵn sàng để thiết kế.
license: MIT
version: "1.0.0"
tags: ["carousel", "facebook", "infographic", "vietnamese", "content-creation"]
---

# Phong Carousel Writer

Tạo carousel 7-10 slides chuẩn thương hiệu Phong Menly — màu `#EFFF00` + `#111111`, 1 ý/slide, CTA cuối.

## Ngữ cảnh (tự động áp dụng)

**Brand Colors:**
- Nền: `#111111` (dark) hoặc `#F5F5F5` (light)
- Accent/Highlight: `#EFFF00` (Neon Yellow signature)
- Chữ chính: `#FFFFFF` (trên nền dark) hoặc `#111111` (trên nền light)

**Phong cách:**
- Slide 1 (Cover): 1 câu hook mạnh + số slide
- Mỗi slide chỉ có 1 ý — không nhồi nhét
- Font lớn — đọc được khi thumbnail nhỏ
- Slide cuối: CTA đơn lẻ, rõ ràng

## Cấu trúc carousel chuẩn (7-10 slides)

| Slide | Vai trò | Nội dung |
|-------|---------|---------|
| 1 | Cover (Hook) | Tiêu đề giật tít + Số slides |
| 2 | Problem | Nỗi đau cụ thể người đọc đang gặp |
| 3-7 | Content | Mỗi slide = 1 điểm / 1 bước (dùng số thứ tự) |
| 8-9 | Proof | Kết quả thật / số liệu / ví dụ |
| 10 | CTA | 1 hành động duy nhất |

## Template Cover Slide hay hoạt động

- "[Số] điều về AI mà 99% người dùng bỏ qua"
- "Tôi đã [hành động bất ngờ]. Đây là [số] bài học"
- "[Số] bước để [kết quả] — không cần code"
- "Mình kiếm [số tiền] từ affiliate AI. Đây là hệ thống"

## Format mỗi slide content (Slide 3-7)

```
SLIDE [SỐ]

HEADING: [Tiêu đề ngắn — 5 từ trở lại, in hoa hoặc to]
SUBTEXT: [Mô tả 2-3 dòng]
EXAMPLE: [Ví dụ cụ thể hoặc số liệu nếu có]
DESIGN NOTE: [Màu nền, icon gợi ý nếu cần]
```

## Input

```
{
  topic: string           # (bắt buộc) Chủ đề carousel
  pillar: string          # (tùy chọn) Pillar nội dung
  num_slides: number      # (tùy chọn, mặc định: 8) 5-12
  has_data: string        # (tùy chọn) Số liệu/kết quả thật để đưa vào
  cta_goal: string        # (tùy chọn) "engagement" | "affiliate" | "khóa học" | "follow"
  style: string           # (tùy chọn) "dark" (#111111 bg) | "light" (#F5F5F5 bg)
}
```

## Output Format

```markdown
## Carousel: [Chủ đề]
**Pillar:** [Pillar] | **Style:** [Dark/Light] | **Tổng slides:** [Số]

---

### SLIDE 1 — COVER
**Tiêu đề chính:** [Hook title — chữ lớn]
**Phụ đề:** [Mô tả ngắn hoặc "Swipe để xem →"]
**Design:** Nền `#111111`, chữ `#EFFF00`, icon AI glow effect

---

### SLIDE 2 — PROBLEM
**Heading:** [Nỗi đau]
**Text:** [Mô tả 2-3 dòng]

---

### SLIDE 3 — ĐIỂM 1
**Số:** 01
**Heading:** [Tiêu đề điểm]
**Text:** [Giải thích 2-3 dòng]
**Ví dụ:** [Cụ thể]

[... tiếp tục các slides...]

---

### SLIDE [CUỐI] — CTA
**Heading:** [Tiêu đề hành động]
**CTA:** [1 câu hành động duy nhất]
**Link/Hướng dẫn:** [Comment từ khóa / Link bio / Follow]

---

### Caption Facebook
[Caption đầy đủ để đăng kèm carousel]
```

## Checklist tự kiểm

- [ ] Slide 1 cover đủ mạnh để dừng scroll?
- [ ] Mỗi slide chỉ có 1 ý duy nhất?
- [ ] Chữ đủ lớn để đọc khi thumbnail nhỏ?
- [ ] Màu `#EFFF00` được dùng nhất quán cho highlight?
- [ ] Slide cuối có 1 CTA duy nhất?
- [ ] Tổng slide 7-10 (không ít hơn 5, không nhiều hơn 12)?

## Bước tiếp theo

- "Thiết kế carousel này trong Canva" → dùng màu: nền `#111111`, accent `#EFFF00`
- "Viết bài Facebook từ carousel này" → `/phong-post-writer`
- "Repurpose thành TikTok" → `/phong-tiktok-writer`
