---
name: skills
description: >
  Hiển thị toàn bộ danh sách skills có sẵn trong workspace Phong Menly.
  Dùng khi cần biết có thể làm gì, skill nào phù hợp với task hiện tại,
  hoặc muốn xem hướng dẫn sử dụng hệ thống skills.
---

# Skills Index — Phong Menly Workspace

Hệ thống gồm **6 Phong Skills** (tùy chỉnh cho Phong) + **52 Affiliate Skills** (global).

**Nền tảng đang hoạt động:** Facebook · Instagram · LinkedIn · X · TikTok · YouTube

---

## 🎯 Phong Skills (Tùy chỉnh — Dùng trước)

Các skills này đã được cài đặt sẵn brand voice, tiếng Việt, và context của Phong.

| Slash Command | Mô tả | Dùng khi |
|--------------|-------|---------|
| `/phong-post-writer` | Viết bài FB / IG / LinkedIn / X (chỉ định platform hoặc xuất cả 4) | Cần bài text cho MXH |
| `/phong-tiktok-writer` | Kịch bản TikTok / Reels / Shorts 30–60s | Cần script video ngắn |
| `/phong-carousel-writer` | Tạo carousel 7–10 slides (FB + IG) | Cần bài nhiều ảnh, infographic |
| `/phong-repurpose` | Biến 1 nội dung → 6 nền tảng (FB/IG/LI/X/TikTok/YT) | Đã có bài/video và muốn nhân bản |
| `/phong-affiliate-finder` | Tìm chương trình affiliate AI phù hợp | Cần tìm tool mới để promote |
| `/phong-weekly-plan` | Lên lịch nội dung 7 ngày | Cần kế hoạch tuần |

---

## 📚 Affiliate Skills (52 Skills — Global)

### Stage 1: Research & Discovery
| Command | Mô tả |
|---------|-------|
| `/affiliate-program-search` | Tìm & đánh giá chương trình affiliate |
| `/commission-calculator` | Tính thu nhập dự kiến trước khi join |
| `/competitor-spy` | Phân tích chiến lược affiliate của đối thủ |
| `/content-angle-ranker` | Đánh giá góc nhìn nội dung theo engagement |
| `/monopoly-niche-finder` | Tìm ngách thị trường chưa có cạnh tranh |
| `/niche-opportunity-finder` | Phát hiện cơ hội affiliate chưa được khai thác |
| `/purple-cow-audit` | Đánh giá điểm nổi bật của sản phẩm (1-10) |
| `/traffic-analyzer` | Phân tích traffic và domain strength |
| `/trending-content-scout` | Theo dõi nội dung viral theo platform |

### Stage 2: Content Creation
| Command | Mô tả |
|---------|-------|
| `/content-pillar-atomizer` | Biến 1 bài → 15-30 micro content |
| `/content-research-brief` | Nghiên cứu nguồn trước khi viết |
| `/infographic-generator` | Tạo layout infographic |
| `/reddit-post-writer` | Viết bài Reddit authentic |
| `/tiktok-script-writer` | Script TikTok affiliate (English) |
| `/twitter-thread-writer` | Viết Twitter/X thread |
| `/viral-post-writer` | Viết social post viral affiliate (English) |

### Stage 3: Blog & SEO
| Command | Mô tả |
|---------|-------|
| `/affiliate-blog-builder` | Viết bài blog review SEO-optimized |
| `/comparison-post-writer` | Bài so sánh "X vs Y" |
| `/content-decay-detector` | Phát hiện bài ranking bị tụt |
| `/how-to-tutorial-writer` | Bài hướng dẫn từng bước |
| `/keyword-cluster-architect` | Phân cụm 50-200+ keywords |
| `/listicle-generator` | Bài "Top N" roundup |

### Stage 4: Landing Pages
| Command | Mô tả |
|---------|-------|
| `/landing-page-creator` | Tạo landing page HTML |
| `/grand-slam-offer` | Xây dựng offer không thể từ chối |
| `/bonus-stack-builder` | Tạo bonus package hấp dẫn |
| `/squeeze-page-builder` | Trang capture email |
| `/value-ladder-architect` | Map hành trình từ free → premium |
| `/webinar-registration-page` | Trang đăng ký webinar |

### Stage 5: Distribution
| Command | Mô tả |
|---------|-------|
| `/social-media-scheduler` | Lịch đăng 30 ngày |
| `/email-drip-sequence` | Chuỗi email tự động |
| `/bio-link-deployer` | Tạo link hub (kiểu Linktree) |

### Stage 6: Analytics
| Command | Mô tả |
|---------|-------|
| `/performance-report` | Báo cáo KPI affiliate |
| `/ab-test-generator` | Tạo variants A/B test |
| `/conversion-tracker` | Setup UTM tracking |
| `/seo-audit` | Audit SEO on-page |

### Stage 7: Automation
| Command | Mô tả |
|---------|-------|
| `/content-repurposer` | Repurpose nội dung đa platform (English) |
| `/email-automation-builder` | Workflow email tự động |
| `/multi-program-manager` | Quản lý danh mục affiliate |
| `/paid-ad-copy-writer` | Viết copy quảng cáo trả phí |

### Stage 8: Meta
| Command | Mô tả |
|---------|-------|
| `/funnel-planner` | Thiết kế toàn bộ affiliate funnel |
| `/compliance-checker` | Kiểm tra FTC và platform compliance |
| `/self-improver` | Review và tối ưu campaign |
| `/category-designer` | Định nghĩa market category |

---

## 🔄 Workflow gợi ý theo Use Case

### Muốn viết bài cho 1 nền tảng
```
/phong-post-writer topic: "[chủ đề]" platform: "facebook"
/phong-post-writer topic: "[chủ đề]" platform: "linkedin"
/phong-post-writer topic: "[chủ đề]" platform: "x"
/phong-post-writer topic: "[chủ đề]" platform: "instagram"
```

### Muốn xuất bài cho cả 4 nền tảng text cùng lúc
```
/phong-post-writer topic: "[chủ đề]" platform: "all"
```

### Muốn tạo TikTok
```
/phong-tiktok-writer topic: "[chủ đề]" duration: 45
```

### Có YouTube video → nhân bản đa platform
```
/phong-repurpose source: "[link/mô tả video]"
```

### Tìm affiliate mới để promote
```
/phong-affiliate-finder niche: "ai-video"
```
→ sau đó: `/phong-post-writer` với sản phẩm tìm được

### Lên kế hoạch tuần
```
/phong-weekly-plan week_theme: "[chủ đề tuần]"
```

### Research trend trước khi viết
```
/trending-content-scout keyword: "[chủ đề]"
```
→ sau đó: `/phong-post-writer` với data từ trend scout
