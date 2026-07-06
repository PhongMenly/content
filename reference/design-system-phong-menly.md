# Design System — Phong Menly (Dark Luxury)

> Học từ landing page "Mật Mã Tự Do — Affiliate x AI" (06/07/2026).
> Đây là phong cách DARK LUXURY: nền đen ấm + vàng gold + cam gradient.
> Dùng cho: landing page, poster, slide, dashboard, ảnh bài đăng.

---

## 1. Bảng màu (Color Palette)

### Nền (Background)
| Vai trò | HEX | Ghi chú |
|---------|-----|---------|
| Nền chính | `#0B0B09` | Đen ấm, không phải đen tuyệt đối |
| Nền glow sau hero | `#1A1408` | Đen pha nâu vàng, dùng radial-gradient tỏa từ giữa |
| Card / chip tối | `#1A1A18` | Pill công cụ, nút phụ |
| Viền chip | `#2E2C28` | Border 1px cho card tối |

### Màu nhấn (Accent)
| Vai trò | HEX | Ghi chú |
|---------|-----|---------|
| Gold CTA chính | `#F5B517` | Nút "Mở Khóa Ngay" |
| Gold CTA sáng (gradient) | `#FFCE45` | Gradient: `#F5B517 → #FFCE45` |
| Cam highlight headline | `#FF7A00` | Chữ nhấn trong tiêu đề |
| Cam sáng (gradient chữ) | `#FFAE33` | Gradient chữ: `#FF7A00 → #FFAE33` |
| Gold viền badge | `#C9A227` | Viền pill "MẬT MÃ TỰ DO" |
| Đỏ khẩn cấp | `#D62B2B` | Banner countdown, tạo cảm giác gấp |

### Chữ (Text)
| Vai trò | HEX |
|---------|-----|
| Chữ chính trên nền tối | `#FFFFFF` |
| Chữ phụ / mô tả | `#A0A0A0` |
| Chữ trên nút gold | `#111111` |

### Công thức phối (quy tắc 60-30-10)
- 60% nền đen ấm `#0B0B09`
- 30% trắng/xám cho chữ
- 10% gold + cam cho CTA, số liệu, từ khóa — CHỈ nhấn chỗ muốn mắt nhìn vào
- Đỏ `#D62B2B` dùng DUY NHẤT cho yếu tố khẩn cấp (đếm ngược, khuyến mãi)

---

## 2. Kiểu chữ (Typography)

### Font đề xuất (Google Fonts, hỗ trợ tiếng Việt tốt)
| Vai trò | Font | Weight |
|---------|------|--------|
| Tiêu đề lớn (headline) | Be Vietnam Pro | 800 (ExtraBold) |
| Tiêu đề phụ (section) | Be Vietnam Pro | 700 (Bold) |
| Nội dung (body) | Be Vietnam Pro | 400 (Regular) |
| Nút bấm | Be Vietnam Pro | 700 (Bold) |
| Chữ ký / logo cá nhân | Dancing Script hoặc Great Vibes | 400 |

Import: `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700;800&display=swap`

### Cỡ chữ (Type Scale — desktop)
| Cấp | Size | Line-height | Dùng cho |
|-----|------|-------------|----------|
| Hero H1 | 56–64px | 1.15 | Tiêu đề chính landing |
| H2 section | 36–40px | 1.2 | "Đại Sứ Thương Hiệu..." |
| H3 | 24px | 1.3 | Tiêu đề card |
| Body | 16px | 1.6 | Đoạn văn |
| Small / caption | 13px | 1.5 | Ghi chú, meta |

Mobile: Hero H1 giảm còn 32–40px.

### Kỹ thuật chữ nhấn trong headline
- Câu trắng, TỪ KHÓA quan trọng tô gradient cam:
  `background: linear-gradient(90deg, #FF7A00, #FFAE33); -webkit-background-clip: text; color: transparent;`
- Mỗi dòng headline chỉ nhấn 1 cụm từ, không nhấn cả câu

---

## 3. Component Recipes

### Nút CTA chính (gold pill)
```css
background: linear-gradient(180deg, #FFCE45, #F5B517);
color: #111111; font-weight: 700;
border-radius: 999px; padding: 14px 32px;
box-shadow: 0 6px 24px rgba(245, 181, 23, 0.35); /* glow */
```

### Nút phụ (ghost pill)
```css
background: rgba(255,255,255,0.06);
border: 1px solid #2E2C28; color: #FFFFFF;
border-radius: 999px; padding: 14px 28px;
```

### Badge trên headline (pill gold outline)
```css
background: rgba(201,162,39,0.08);
border: 1px solid #C9A227; color: #E8C34E;
border-radius: 999px; font-size: 13px; padding: 6px 16px;
```

### Glow sau sản phẩm/hero
```css
background: radial-gradient(ellipse at center, rgba(245,181,23,0.18), transparent 65%);
```

### Chip công cụ / logo đối tác
```css
background: #1A1A18; border: 1px solid #2E2C28;
border-radius: 999px; color: #FFFFFF; padding: 10px 20px;
```

---

## 4. Quan hệ với brand kit gốc (CLAUDE.md mục 8)

Hai hệ màu dùng theo ngữ cảnh, KHÔNG trộn lẫn trong cùng 1 thiết kế:

| | Neon Light (gốc) | Dark Luxury (mới học) |
|---|---|---|
| Nền | Xám sáng `#F5F5F5` | Đen ấm `#0B0B09` |
| Nhấn | Neon yellow `#EFFF00` | Gold `#F5B517` + cam `#FF7A00` |
| Cảm giác | Công nghệ, trẻ, sạch | Cao cấp, bán hàng, khan hiếm |
| Dùng cho | Dashboard, infographic, carousel kiến thức | Landing page bán hàng, sách, khóa học, poster launch |

Quy tắc chọn: nội dung CHIA SẺ GIÁ TRỊ dùng Neon Light; nội dung BÁN HÀNG / RA MẮT SẢN PHẨM dùng Dark Luxury.
