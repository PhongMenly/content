# Roadmap Nâng cấp Hệ thống Content Studio — Phong Menly

Ngày lập: 06/07/2026 (rà soát toàn bộ hệ thống bởi Claude Agent)

---

## 1. HIỆN TRẠNG — Những gì đã có và chạy tốt

| Thành phần | Vai trò | Trạng thái |
|-----------|---------|-----------|
| Dashboard (Express + Neon + Vercel Blob) | Quản lý bài, duyệt, lịch đăng, thống kê | Chạy local + Vercel |
| Pipeline Agent → Chờ duyệt → Duyệt → Tự lên lịch 11:00/21:00 | Luồng sản xuất nội dung | Hoàn chỉnh |
| Bot Uyên Nhi (Telegram) | Duyệt bài từ điện thoại, trả lời khách, học FAQ | Chạy pm2 24/7 khi máy bật |
| facebook-bot (Graph API) | Tự đăng bài lên Page đúng giờ | Hoạt động |
| Chia sẻ group (Edge automation) | Đăng vào hội nhóm như người thật | Đã xây, chờ đăng nhập + danh sách group |
| Cron runner (mới vá 06/07) | Gọi tự đăng mỗi 5 phút | Chạy pm2 |
| pm2 + tự khởi động Windows | 4 tiến trình tự sống lại khi restart máy | Hoạt động |

## 2. ĐIỂM YẾU PHÁT HIỆN (xếp theo mức nghiêm trọng)

1. ~~KHÔNG có gì gọi API tự đăng~~ — ĐÃ VÁ 06/07 bằng cron-runner.js (trước đó bài lên lịch sẽ không bao giờ đăng)
2. Toàn bộ hệ thống chết khi tắt máy — mọi thứ chạy trên 1 PC Windows
3. Chưa có Git — không lịch sử code, không rollback được, sửa hỏng là mất
4. 2 bản dashboard (localhost + Vercel) lệch code — bản Vercel còn bug múi giờ cũ, thiếu tính năng mới (xóa bài, chia sẻ group)
5. Bảo mật mỏng — 1 mật khẩu chung, token nằm rải rác trong .env và memory, chưa xoay vòng
6. Chỉ đăng được Facebook — 5 nền tảng còn lại (IG, TikTok, X, LinkedIn, YouTube) vẫn thủ công dù lịch đăng CLAUDE.md yêu cầu hằng ngày
7. Thống kê nông — chỉ like/comment/share; chưa đo reach, click link affiliate, doanh thu theo bài/pillar
8. Chia sẻ group dễ gãy — phụ thuộc giao diện Facebook, chưa có UI quản lý danh sách group
9. Độ trễ DB 1–1.5s (Neon ở xa) — đã cache 15s, chấp nhận được ở quy mô hiện tại

## 3. ROADMAP 4 GIAI ĐOẠN

### Giai đoạn 1 — Nền móng vững (tuần này, ưu tiên cao nhất)
Mục tiêu: không mất dữ liệu, không lệch code, vận hành tin cậy được.
- [x] Cron tự đăng bài (xong 06/07)
- [ ] `git init` + đưa lên GitHub private + nối Vercel auto-deploy → hết cảnh 2 bản lệch nhau
- [ ] Đưa toàn bộ secret về 1 file .env chuẩn, đổi mật khẩu dashboard đủ mạnh
- [ ] Backup tự động DB Neon (export hàng ngày ra file/Drive)
- [ ] Trang Cài đặt trên dashboard: quản lý danh sách group, khung giờ đăng, xem log chia sẻ
- [ ] Thông báo Telegram khi bài đăng thành công / thất bại (nối cron-runner → bot)

### Giai đoạn 2 — Làm chủ Facebook (QUYẾT ĐỊNH 06/07: chỉ tập trung Facebook, bỏ đa nền tảng)
Mục tiêu: khai thác tối đa 1 kênh Facebook — Page + Group + đo lường.
- [ ] Hoàn tất chia sẻ group: user đăng nhập FB cho bot + điền danh sách group vào trang Cài đặt
- [ ] Tự động chia sẻ vào group SAU KHI bài đăng Page thành công (nối vào cron: đăng xong → chờ 15-30 phút → chia sẻ group)
- [ ] Đăng bài kèm nhiều ảnh (album) và video lên Page
- [ ] Trả lời comment tự động / kéo comment về Telegram để trả lời nhanh
- [ ] Theo dõi giờ vàng: phân tích giờ đăng nào ra tương tác cao nhất từ số liệu thật

### Giai đoạn 3 — Đo tiền, không chỉ đo like (1–2 tháng)
Mục tiêu: biết bài nào/pillar nào RA TIỀN để dồn lực đúng chỗ.
- [ ] Link shortener tự quản (go.kolaisystem...) gắn UTM tự động vào mọi link affiliate trong bài
- [ ] Dashboard doanh thu: click → conversion → hoa hồng, theo bài / pillar / nền tảng
- [ ] Báo cáo tuần tự động gửi Telegram: top bài, top pillar, doanh thu, đề xuất tuần sau
- [ ] A/B hook: mỗi bài lưu 3 hook, hệ thống luân phiên và ghi nhận hook thắng

### Giai đoạn 4 — Scale thành sản phẩm (2–3 tháng)
Mục tiêu: chạy 24/7 không cần máy bật, và biến chính hệ thống thành sản phẩm bán.
- [ ] Chuyển bot + cron + automation lên VPS (~5-10$/tháng) — tắt máy vẫn chạy
- [ ] Multi-account: quản nhiều Page/nhiều thương hiệu trong 1 dashboard
- [ ] Phân quyền team: người viết, người duyệt, admin
- [ ] Đóng gói thành "KOL AI System" bán cho học viên (khớp hệ sinh thái Building KOL AI System) — chính hệ thống này là case study + demo sản phẩm

## 4. NGUYÊN TẮC KHI XÂY
- Mỗi giai đoạn xong phải CHẠY THẬT rồi mới sang giai đoạn sau
- Ưu tiên tính năng ra tiền (Giai đoạn 3) hơn tính năng đẹp
- Mọi automation phải có giới hạn an toàn tài khoản (nhịp chậm, max/lần)
- Bài học từ CLAUDE.md: "Nếu không dám để INTERN làm không giám sát — đừng để agent làm không giám sát" → mọi bài đăng đều qua duyệt
