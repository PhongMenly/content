---
name: phong-repurpose
description: >
  Repurpose nội dung của Phong Menly sang nhiều nền tảng. Dùng khi có 1 bài viết,
  1 video, hoặc 1 ý tưởng và muốn tạo ra nhiều nội dung cho Facebook, TikTok,
  YouTube, carousel từ nguồn đó. Tự động áp dụng quy trình repurpose 1→5 chuẩn.
license: MIT
version: "1.0.0"
tags: ["repurpose", "content-multiplication", "vietnamese", "automation"]
---

# Phong Repurpose

Biến 1 nội dung thành 5+ bài đăng đa nền tảng — giữ nguyên core message, thay đổi format cho từng platform.

## Nguyên tắc

- **Không copy-paste:** Mỗi platform cần giọng văn riêng
- **Core message không đổi:** Chỉ thay format và angle
- **Native first:** Viết như bài gốc của nền tảng đó, không cảm giác "đăng lại"

## Quy trình repurpose chuẩn (6 nền tảng)

```
NGUỒN GỐC (YouTube / Facebook / Ý tưởng)
                    ↓
      ┌─────────────┼──────────────┐
      ↓             ↓              ↓
  Facebook      LinkedIn          X Thread
  Text post     Chuyên nghiệp     5–10 tweets
  (insight)     (first comment)   (breakdown)
      ↓             ↓              ↓
  TikTok       Instagram        YouTube Short
  30–60s        Reels/Carousel    60s clip
  (1 bước)      (visual)          (highlight)
      ↓
  Story (FB + IG)
  (1 câu/số liệu)
```

## Input

```
{
  source_content: string    # (bắt buộc) Nội dung gốc hoặc mô tả ý tưởng
  source_type: string       # (tùy chọn) "youtube" | "facebook" | "idea" | "story"
  target_platforms: array   # (tùy chọn, mặc định: tất cả) ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube-short", "carousel", "story"]
  affiliate_product: string # (tùy chọn) Sản phẩm affiliate muốn lồng ghép
  key_insight: string       # (tùy chọn) Insight quan trọng nhất cần giữ lại
}
```

## Quy trình thực hiện

### Bước 1: Phân tích nguồn
Trích xuất từ nội dung gốc:
- Core message (1 câu)
- 3-5 điểm/bước chính
- Số liệu hoặc câu chuyện hay nhất
- Hook mạnh nhất

### Bước 2: Tạo cho từng nền tảng

**Facebook Post (200–400 từ)**
- Hook = insight mạnh nhất (KHÔNG bắt đầu "Tôi vừa đăng video...")
- Viết lại bằng text, không tóm tắt nguồn
- Kết bằng câu hỏi kích comment
- Giọng: "mình/bạn", thân thiện, tiếng Việt

**Instagram Caption (50–150 từ)**
- Hook trong dòng đầu (trước "more")
- Ngắn hơn Facebook, emoji tự nhiên hơn
- Hashtag: 5–15 tags (#AI #AItools #VietnamAI #phongmenly)
- Link → bio only: "Link trong bio nha"

**LinkedIn Post (150–350 từ)**
- Giọng chuyên nghiệp hơn, dùng "tôi"
- Hook = góc nhìn founder/insight thật
- KHÔNG đặt link trong body → "Link trong first comment"
- Hashtag: 3–5 tags (#AI #StartupFounder #AffiliateAI)

**X Thread (5–10 tweets)**
- Tweet 1: Hook mạnh nhất ≤ 280 ký tự
- Tweet 2–8: Breakdown từng điểm, mỗi tweet = 1 ý
- Tweet cuối: CTA + link
- Có thể viết bằng tiếng Anh để reach global AI community
- Format: "1/ [hook] \n2/ [điểm 1] \n..."

**TikTok Script (45s)**
- Chỉ lấy 1 bước/1 mẹo duy nhất từ nguồn
- Hook visual trong 3s đầu
- CTA: "Follow để xem đủ [X] bước"

**Instagram Reels = TikTok**
- Cùng script, đăng cross-platform
- Điều chỉnh hashtag cho Instagram

**YouTube Short (60s)**
- Lấy moment ấn tượng nhất hoặc kết quả
- Thoại ít hơn, visual nhiều hơn
- CTA: "Link video đầy đủ trong description"

**Carousel (7–8 slides — FB + IG)**
- Framework/list từ nguồn gốc
- Theo cấu trúc: Cover → Problem → 5 điểm → CTA

**Story — FB + IG (15s)**
- 1 câu quote hay nhất hoặc 1 số liệu ấn tượng
- Design: `#111111` nền + `#EFFF00` chữ

### Bước 3: Lịch đăng gợi ý
Đề xuất thứ tự đăng trong tuần để tối đa reach.

## Output Format

```markdown
## Repurpose: [Tên chủ đề]

**Core Message:** [1 câu tóm tắt ý chính]
**Best Hook:** [Câu hook mạnh nhất từ nguồn]

---

### 1. Facebook Post (200–400 từ)
[Bài viết đầy đủ — giọng thân thiện, "mình/bạn"]

---

### 2. Instagram Caption (50–150 từ)
[Caption ngắn + hashtag list]

---

### 3. LinkedIn Post (150–350 từ)
[Bài viết — giọng chuyên nghiệp hơn, link trong first comment]

---

### 4. X Thread (5–8 tweets)
[1/ hook \n 2/ điểm 1 \n ... \n n/ CTA + link]

---

### 5. TikTok / Reels Script (45s)
[Kịch bản theo format scene table]

---

### 6. YouTube Short (60s)
[Script/hướng dẫn cắt clip]

---

### 7. Carousel (8 slides — FB + IG)
[Nội dung từng slide]

---

### 8. Story FB + IG (15s)
[1 câu + hướng dẫn design màu brand]

---

### Lịch đăng gợi ý
| Ngày | Nền tảng | Nội dung |
|------|----------|---------|
| Hôm nay | Facebook | Bài post chính |
| Hôm nay | X | Thread breakdown |
| Ngày 2 | TikTok + Reels | Video ngắn |
| Ngày 2 | LinkedIn | Bài professional |
| Ngày 3 | Instagram | Carousel |
| Ngày 4 | YouTube | Short |
| Ngày 5 | FB + IG Story | Quote card |
```
