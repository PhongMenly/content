---
name: phong-weekly-plan
description: >
  Lên kế hoạch nội dung tuần cho Phong Menly. Dùng khi cần lịch đăng bài tuần,
  kế hoạch content 7 ngày, hoặc phân phối nội dung theo 5 pillar và 3 nền tảng.
  Tự động cân bằng pillar, thêm CTA phù hợp, và xuất lịch sẵn sàng thực hiện.
license: MIT
version: "1.0.0"
tags: ["planning", "content-calendar", "weekly", "vietnamese"]
---

# Phong Weekly Content Plan

Lên kế hoạch 7 ngày nội dung đa nền tảng — cân bằng 5 pillar, 3 platform, và mục tiêu tuần.

## Ngữ cảnh tự động

**Lịch đăng chuẩn:**
- Facebook: 1 bài/ngày
- TikTok: 1-2 video/ngày
- YouTube: 2-3 video/tuần

**Phân bổ Pillar chuẩn tuần:**
- 🤖 AI Thực chiến: 2 ngày
- 💰 Kiếm tiền với AI: 1-2 ngày
- ⚙️ Build & Vibe Coding: 1-2 ngày
- 🧠 Tư duy & Góc nhìn: 1 ngày
- 🎬 Video & Content AI: 1 ngày

## Quy trình lên kế hoạch

### Bước 1: Thu thập thông tin
Hỏi (nếu chưa có):
1. Tuần này có sự kiện/launch/chủ đề đặc biệt không?
2. Có sản phẩm/affiliate nào cần push tuần này?
3. Có video YouTube nào cần đăng không?
4. Mục tiêu tuần: Engagement / Affiliate / Brand building?

### Bước 2: Tạo kế hoạch 7 ngày

**Framework phân bổ tuần:**

| Thứ | Pillar | Loại nội dung | Nền tảng | CTA hướng tới |
|-----|--------|--------------|----------|--------------|
| Hai | AI Thực chiến | Tutorial/Hướng dẫn | FB + TikTok | Engagement |
| Ba | Kiếm tiền với AI | Affiliate/Case study | FB | Affiliate link |
| Tư | Build & Vibe Coding | Demo/Behind-the-scenes | TikTok + YT | Follow/Subscribe |
| Năm | Tư duy & Góc nhìn | Insight cá nhân | FB | Engagement |
| Sáu | Video & Content AI | Mẹo nhanh | TikTok + YT Short | Follow |
| Bảy | AI Thực chiến | Case study/Kết quả thật | FB + YT | Khóa học/Tư vấn |
| CN | Tư duy/Tổng kết | Motivational/Nhìn lại | FB | Community |

### Bước 3: Repurpose mapping
Với mỗi ý tưởng YouTube → map sang Facebook post + TikTok.

## Input

```
{
  week_theme: string         # (tùy chọn) Chủ đề chung của tuần
  special_events: string     # (tùy chọn) Launch, webinar, deadline...
  affiliate_push: string     # (tùy chọn) Sản phẩm cần push tuần này
  youtube_videos: array      # (tùy chọn) YouTube videos lên sóng tuần này
  goal: string               # (tùy chọn) "engagement" | "affiliate" | "awareness" | "launch"
  content_ideas: string      # (tùy chọn) Ý tưởng có sẵn muốn đưa vào
}
```

## Output Format

```markdown
## Kế hoạch Nội dung Tuần [Ngày - Ngày]

**Chủ đề tuần:** [Theme]
**Mục tiêu:** [Goal]
**Sản phẩm push:** [Nếu có]

---

### Lịch 7 ngày

#### Thứ Hai — [Pillar]
**Ý tưởng:** [Tên bài/video]
**Facebook:** [Mô tả bài post — 2 dòng]
**TikTok:** [Mô tả video — 2 dòng]
**CTA:** [Mục tiêu conversion]
**Repurpose từ:** [Nếu có YouTube video]
**Status:** [ ] Draft | [ ] Done

[... tiếp tục Thứ Ba → Chủ Nhật ...]

---

### Lịch YouTube tuần này
| Ngày đăng | Tiêu đề | Độ dài | Pillar |
|-----------|---------|--------|--------|
...

---

### Checklist chuẩn bị
- [ ] Tất cả ideas đã được assign ngày
- [ ] YouTube videos đã schedule
- [ ] Affiliate links đã sẵn sàng
- [ ] Carousel/infographic cần thiết kế trước: [List]

---

### Prompt nhanh để tạo nội dung
- Viết bài Thứ Hai → `/phong-post-writer` topic: "[topic]"
- TikTok Thứ Tư → `/phong-tiktok-writer` topic: "[topic]"
- Repurpose YouTube → `/phong-repurpose` source: "[link/mô tả]"
```
