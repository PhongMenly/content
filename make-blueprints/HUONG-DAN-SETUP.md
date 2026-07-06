# Hướng dẫn Import Blueprint vào Make.com

## Bước 1 — Tạo Google Sheets

Tạo file Google Sheets mới với tên: **Email Marketing Contacts**

Tạo sheet tên **Contacts** với các cột theo đúng thứ tự:

| Cột | Tên header | Ví dụ |
|-----|-----------|-------|
| A | Cot A - Email | phongconson@gmail.com |
| B | Cot B - Ten | Phong |
| C | Cot C - Nguon | TikTok / Facebook / Landing Page |
| D | Cot D - Ngay dang ky | 2026-05-15 |
| E | Cot E - Trang thai | active / unsubscribed / completed |
| F | Cot F - Buoc sequence | 0 / 1 / 2 / 3 / 4 |
| G | Cot G - Ngay gui cuoi | 2026-05-15 |

Lấy Spreadsheet ID từ URL:
https://docs.google.com/spreadsheets/d/**[SPREADSHEET_ID_O_DAY]**/edit

---

## Bước 2 — Lấy Resend API Key mới

1. Vào resend.com/api-keys
2. Tạo API key mới (key cũ đã bị xóa)
3. Copy key dạng: re_xxxxxxxxxxxx

---

## Bước 3 — Import từng Scenario vào Make

### Với mỗi file JSON:
1. Vào make.com → Scenarios → Create a new scenario
2. Click dấu 3 chấm (...) góc phải → Import Blueprint
3. Upload file JSON tương ứng
4. Sau khi import, Make sẽ báo lỗi kết nối → Bình thường, làm theo Bước 4

---

## Bước 4 — Thay thế các giá trị placeholder

Sau khi import, tìm và thay thế trong từng module:

| Placeholder | Thay bằng |
|-------------|----------|
| THAY_BANG_SPREADSHEET_ID_CUA_BAN | ID lấy từ URL Google Sheets |
| THAY_BANG_RESEND_API_KEY | API key từ resend.com |
| DOMAIN_CUA_BAN.com | Domain email của bạn (đã verify trên Resend) |

---

## Bước 5 — Kết nối tài khoản trong Make

Với mỗi module Google Sheets:
1. Click vào module
2. Click "Add" bên cạnh Connection
3. Đăng nhập Google Account

---

## Bước 6 — Setup lịch cho Scenario 2

1. Mở Scenario 2 (Daily Sequence Runner)
2. Click icon đồng hồ góc trái màn hình
3. Chọn: Every Day — lúc 08:00

---

## Bước 7 — Lấy Webhook URL cho Scenario 3 và 4

1. Mở Scenario 3 (Broadcast)
2. Click module đầu tiên (Webhook)
3. Copy URL webhook — dùng để trigger broadcast thủ công
4. Làm tương tự với Scenario 4 (Unsubscribe)
5. URL Unsubscribe webhook paste vào link hủy đăng ký trong email

---

## Cách trigger Broadcast thủ công

Khi muốn gửi email hàng loạt, gọi webhook bằng:

```
POST https://hook.eu2.make.com/[WEBHOOK_ID_CUA_BAN]
Content-Type: application/json

{
  "subject": "Tiêu đề email của bạn",
  "html_content": "<p>Nội dung HTML email của bạn</p>"
}
```

Hoặc dùng tool như Postman / Hoppscotch để gọi API này.

---

## Kiểm tra hệ thống hoạt động

1. Thêm 1 dòng test vào Google Sheets (email thật của bạn)
2. Chờ 1-2 phút
3. Kiểm tra inbox — email chào mừng phải đến
4. Nếu không đến → kiểm tra tab History trong Make scenario

---

## Chi phí vận hành

| Giai đoạn | Make | Resend | Tổng |
|-----------|------|--------|------|
| 0-1.000 operations/tháng | Free | Free (3.000 email) | $0 |
| Scale hơn | $9/tháng | $20/tháng | $29/tháng |
