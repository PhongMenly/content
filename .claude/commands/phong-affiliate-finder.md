---
name: phong-affiliate-finder
description: >
  Tìm và đánh giá chương trình affiliate AI/SaaS phù hợp để Phong Menly promote.
  Dùng khi cần tìm chương trình affiliate mới, so sánh commission, đánh giá
  tiềm năng kiếm tiền, hoặc nghiên cứu tool AI để giới thiệu cho audience.
  Tự động filter theo tiêu chí của Phong: recurring commission, AI/SaaS niche.
license: MIT
version: "1.0.0"
tags: ["affiliate", "research", "ai-tools", "saas", "vietnamese"]
---

# Phong Affiliate Finder

Tìm chương trình affiliate AI/SaaS tốt nhất cho Phong Menly — ưu tiên recurring commission, phù hợp audience Việt Nam.

## Tiêu chí lọc tự động (áp dụng cho Phong)

**Ưu tiên cao:**
- Recurring commission (hoa hồng hàng tháng) > One-time
- AI tools, SaaS, Vibe Coding tools
- Có free trial hoặc freemium → dễ convince audience dùng thử
- Sản phẩm Phong đã dùng thực tế hoặc có thể demo

**Ưu tiên trung bình:**
- Commission ≥ 20% hoặc ≥ $10/conversion
- Cookie duration ≥ 30 ngày
- Có marketing material (banner, link tracking)

**Loại trừ:**
- Tool chưa dùng và không thể verify chất lượng
- Commission quá thấp (< $5/conversion)
- Sản phẩm không liên quan đến AI/Vibe Coding/Content

## Danh mục ưu tiên cho Phong

| Danh mục | Ví dụ | Lý do phù hợp |
|----------|-------|--------------|
| AI Writing | Claude Pro, ChatGPT, Jasper | Audience dùng hàng ngày |
| AI Video | HeyGen, ElevenLabs, Runway | Pillar Video & Content AI |
| Automation | Make.com, n8n, Zapier | AI Agent workflow |
| Vibe Coding | Cursor, Lovable, Bolt.new | Pillar Build & Vibe Coding |
| Landing Page | Framer, Webflow, Carrd | Audience cần build funnel |
| Email Marketing | ConvertKit, ActiveCampaign | Affiliate system |

## Quy trình tìm kiếm

### Bước 1: Search Affitor API
```
GET https://list.affitor.com/api/v1/programs?q=[keyword]&sort=top&limit=10
```
Thử các keyword: "AI video", "AI writing", "automation", "vibe coding", "SaaS"

### Bước 2: Đánh giá theo 5 tiêu chí Phong

| Tiêu chí | Trọng số | Câu hỏi đánh giá |
|----------|---------|------------------|
| Tiềm năng thu nhập | 30% | Recurring? Commission cao? Cookie dài? |
| Phù hợp nội dung | 25% | Có thể demo? Có story để kể? Phong đã dùng chưa? |
| Nhu cầu thị trường | 20% | Audience Việt Nam có biết/cần tool này không? |
| Mức độ cạnh tranh | 15% | Người Việt đang affiliate cái này chưa? |
| Độ tin cậy sản phẩm | 10% | Review tốt? Công ty uy tín? |

### Bước 3: Gợi ý angle nội dung
Với mỗi chương trình phù hợp, gợi ý:
- 1 hook cho Facebook post
- 1 angle TikTok demo
- Cách lồng vào CTA tự nhiên không bị salesy

## Input

```
{
  niche: string         # (tùy chọn) "ai-video" | "automation" | "vibe-coding" | "writing" | "all"
  min_commission: string # (tùy chọn) "10" (USD) mặc định
  commission_type: string # (tùy chọn) "recurring" | "one-time" | "both"
  already_using: string  # (tùy chọn) Các tool Phong đang dùng để exclude
  audience_level: string # (tùy chọn) "beginner" | "intermediate" | "advanced"
}
```

## Output Format

```markdown
## Kết quả tìm kiếm Affiliate AI

**Tìm kiếm cho:** Phong Menly (KOL AI, audience Việt Nam)

---

### Top Picks

| Hạng | Tên chương trình | Commission | Loại | Điểm tổng |
|------|-----------------|-----------|------|-----------|
| 1 | [Tên] | [%/số tiền] | Recurring | [/100] |
...

---

### Phân tích chi tiết: [Top 1]

**Sản phẩm:** [Mô tả ngắn]
**Commission:** [Chi tiết]
**Cookie:** [X ngày]
**Free trial:** [Có/Không]

**Điểm mạnh để promote:**
- [Lý do 1]
- [Lý do 2]

**Angle content gợi ý:**
- Facebook: "[Hook cho bài post]"
- TikTok: "[Góc nhìn cho demo video]"
- CTA tự nhiên: "[Cách đề cập tự nhiên không spam]"

---

### Bước tiếp theo
1. Đăng ký chương trình: [Link]
2. "Viết bài Facebook promote [tên]" → `/phong-post-writer`
3. "Làm TikTok demo [tên]" → `/phong-tiktok-writer`
```
