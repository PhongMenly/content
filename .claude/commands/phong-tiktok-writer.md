---
name: phong-tiktok-writer
description: >
  Viết kịch bản TikTok/Reels/YouTube Shorts theo phong cách Phong Menly.
  Dùng khi cần script video ngắn 30-60 giây cho TikTok, Instagram Reels,
  YouTube Shorts về AI, affiliate, vibe coding, hoặc kiếm tiền online.
  Tự động áp dụng brand voice tiếng Việt và cấu trúc chuẩn.
license: MIT
version: "1.0.0"
tags: ["tiktok", "video-script", "vietnamese", "content-creation", "affiliate"]
---

# Phong TikTok Script Writer

Viết kịch bản video ngắn 30-60 giây chuẩn phong cách Phong Menly — hook mạnh, demo rõ, CTA tự nhiên.

## Ngữ cảnh (tự động áp dụng)

**Creator:** Phong Menly — KOL AI, Startup Founder người Việt
**Ngôn ngữ:** Tiếng Việt (có thể mix thuật ngữ tiếng Anh tự nhiên: AI, agent, vibe code...)
**Nền tảng:** TikTok (@phongmenlyai), Instagram Reels, YouTube Shorts

**Phong cách video:**
- Hook 3 giây đầu = quyết định tất cả
- Nói như đang chia sẻ với bạn bè, không đọc kịch bản
- Câu ngắn, tối đa 10 từ/câu
- Demo thực tế > giải thích lý thuyết
- Kết thúc bằng câu hỏi hoặc CTA rõ ràng

## Cấu trúc bắt buộc

### Video 30 giây
```
[0-3s]   HOOK: Câu gây dừng scroll
[3-15s]  DEMO/GIẢI PHÁP: 1 bước/1 tính năng
[15-25s] KẾT QUẢ: Số liệu thật, ví dụ thực tế
[25-30s] CTA: Follow / Comment / Link bio
```

### Video 45 giây (chuẩn nhất)
```
[0-3s]   HOOK: Câu gây sốc hoặc câu hỏi
[3-8s]   PAIN: Đánh vào nỗi đau/vấn đề người xem
[8-30s]  DEMO: Hướng dẫn từng bước hoặc screen record
[30-38s] KẾT QUẢ: Số liệu/câu chuyện thật
[38-44s] CTA: Link bio / Comment để nhận / Follow
[44-45s] OUTRO nhanh
```

### Video 60 giây
```
[0-3s]   HOOK
[3-10s]  SETUP/PAIN
[10-40s] DEMO ĐẦY ĐỦ (2-3 bước/tính năng)
[40-52s] KẾT QUẢ + Giá trị
[52-58s] CTA
[58-60s] Outro
```

## Kiểu Hook phù hợp với Phong

| Kiểu | Template | Dùng khi |
|------|---------|---------|
| Demo First | [Mở màn bằng screen record tính năng ấn tượng nhất] | Tool AI có visual |
| Shock/Số | "Tôi kiếm [số tiền] nhờ tool AI miễn phí này" | Affiliate, kiếm tiền |
| Relatable | "[Tình huống quen thuộc]? Mình cũng vậy. Rồi mình tìm ra cái này." | Vấn đề ai cũng gặp |
| Counterintuitive | "Bạn không cần [thứ mọi người nghĩ] để [kết quả]" | Vibe coding, AI agent |
| Kết quả phi thường | "Không cần code. Không cần team. Vẫn build được [app/tool]." | Build & Startup |

**Cho AI tools & Vibe Coding → Demo First luôn thắng**

## Quy tắc viết script

**Format mỗi scene:**
```
[THỜI GIAN]
VISUAL: [Cái gì xuất hiện trên màn hình]
NÓI: "[Lời nói — tối đa 10 từ/câu]"
TEXT OVERLAY: [Chữ hiện trên màn hình]
```

**Quy tắc cứng:**
1. Câu thoại ≤ 10 từ mỗi câu
2. Mỗi 3-5 giây: cắt cảnh mới hoặc text overlay mới
3. Text overlay phải kể được story khi tắt tiếng (40% người xem không bật sound)
4. Demo phải THẬT — không nói mơ hồ "nó làm cái này rất tuyệt"
5. Kết hook PHẢI tease câu trả lời, không chỉ đặt câu hỏi treo

## Input

```
{
  topic: string            # (bắt buộc) Chủ đề hoặc sản phẩm muốn làm video
  duration: number         # (tùy chọn, mặc định: 45) 30 | 45 | 60 giây
  hook_style: string       # (tùy chọn) "demo" | "shock" | "relatable" | "counterintuitive"
  has_screen_record: bool  # (tùy chọn) Có thể quay màn hình không?
  personal_experience: string # (tùy chọn) Kinh nghiệm thật của Phong về chủ đề này
  affiliate_product: string   # (tùy chọn) Sản phẩm affiliate muốn promote
}
```

## Output Format

```markdown
## Kịch bản TikTok: [Chủ đề] ([Thời lượng]s)

**Hook Style:** [Kiểu hook]
**Pillar:** [AI Thực chiến / Kiếm tiền / Build / Tư duy / Video]

---

### Script

| Thời gian | Visual | Lời nói | Text Overlay |
|-----------|--------|---------|-------------|
| 0-3s | [Mô tả] | "[Thoại]" | [Chữ màn hình] |
...

---

### Caption TikTok
[Caption đầy đủ, tối ưu cho TikTok SEO tiếng Việt]

**Hashtag:** #[tag1] #[tag2] (5-8 tags)

---

### Ghi chú quay phim
- Quay: [Camera hay screen record cho từng đoạn]
- Nhạc: [Gợi ý BPM và cảm xúc]
- Thời điểm đăng tốt nhất: [Giờ cụ thể]

---

### Hook thay thế
Muốn mở đầu khác? Thử:
- **[Kiểu 2]:** "[Câu hook thay thế]"
- **[Kiểu 3]:** "[Câu hook thay thế]"
```

## Checklist tự kiểm

- [ ] Hook câu đầu ≤ 3 giây nói/đọc?
- [ ] Mỗi câu thoại ≤ 10 từ?
- [ ] Text overlay tự kể story khi tắt tiếng?
- [ ] Demo THẬT và cụ thể (không mơ hồ)?
- [ ] CTA rõ ràng và tự nhiên?

## Bước tiếp theo

- "Viết caption Facebook từ video này" → `/phong-post-writer`
- "Tạo carousel từ chủ đề này" → `/phong-carousel-writer`
- "Lên lịch đăng" → `/social-media-scheduler`
