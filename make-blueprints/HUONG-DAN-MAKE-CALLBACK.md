# Nối chiều về: Make báo ngược lại Dashboard

Mục tiêu: dashboard chỉ được ghi "Đã đăng" khi Make xác nhận bài đã thật sự lên fanpage, kèm `fb_post_id` thật.

## Vì sao phải làm

Make webhook trả `200 Accepted` NGAY CẢ KHI scenario đang TẮT — nó chỉ xếp data vào hàng đợi, chưa chạy gì cả.

Luồng cũ (một chiều, mù):

```
Cron bắn → Make trả 200 → Dashboard ghi "Đã đăng" → HẾT
```

Scenario tắt / hết operations / connection Facebook chết → dashboard vẫn xanh, fanpage trống.

Luồng mới (hai chiều):

```
Cron bắn → Dashboard ghi "Đang gửi Make"
           → Make đăng lên fanpage
           → Make gọi ngược về dashboard kèm fb_post_id
           → Dashboard ghi "Đã đăng" + bắn lên kênh Telegram
Quá 15 phút không thấy gọi về → Nhi báo Telegram cho anh Phong
```

---

## Thông tin endpoint

```
POST https://phong-menly-dashboard.vercel.app/api/cron/make-callback
Header: Authorization: Bearer <CRON_SECRET>
Header: Content-Type: application/json
```

Body khi đăng thành công:

```json
{ "postId": 28, "fbPostId": "786094954576493_123456789" }
```

Body khi lỗi:

```json
{ "postId": 28, "error": "Mô tả lỗi từ Make" }
```

`CRON_SECRET` lấy trong Vercel → Project Settings → Environment Variables (hoặc file `dashboard/.env.local`, dòng `CRON_SECRET`).

---

## TRẠNG THÁI: Bước 2 và 3 đã làm xong qua Make API ngày 23/07/2026

Blueprint scenario 6504441 hiện tại đã là:

```
1. gateway:CustomWebHook           (webhook nhận bài từ dashboard)
2. facebook-pages:CreatePostWithPhotos
   FILTER "Du du lieu moi dang": chỉ chạy khi có đủ postId + message + imageUrl bắt đầu bằng https
3. http:ActionSendData             (gọi ngược về /api/cron/make-callback kèm fb_post_id)
```

Bộ lọc ở module 2 để chặn dữ liệu rác trong hàng đợi webhook — data rỗng sẽ bị bỏ qua thay vì làm scenario lỗi.

Phần chưa làm: nhánh error handler (Bước 3 bên dưới) vẫn nên thêm tay trong giao diện Make. Chưa có nó thì khi Facebook từ chối, dashboard không biết ngay — nhưng canh gác 15 phút vẫn bắt được và nhắn Telegram.

Chẩn đoán ngày 23/07/2026 (đọc qua Make API):

| Hạng mục | Kết quả |
|---|---|
| Scenario 6504441 | isActive = false, ĐANG TẮT — đây là nguyên nhân bài không lên |
| 3 lần chạy cuối 22/07 | Đều lỗi `[400] (#324) Requires upload file` ở module CreatePostWithPhotos |
| Run lúc 21:00 ngày 22/07 | KHÔNG TỒN TẠI — scenario đã tắt nên bài #17 chưa từng được đăng |
| Connection Facebook (id 8889898) | Còn sống, hạn 07/09/2026 |
| Operations | 10-13/ngày, hạn mức 1000/tháng — không thiếu |
| Hàng đợi webhook v2 (hook 3369595) | 5 item đang chờ |
| Hook cũ mồ côi (hook 3368455) | 35 item tồn đọng, không nối scenario nào — nên xóa |
| Ảnh bài #28 và #30 | 12.6 MB và 9.1 MB, vượt giới hạn Facebook — đã nén còn 0.76 MB và 0.50 MB |

---

## Bước 1 — Kiểm tra scenario hiện tại (làm trước tiên)

1. Vào make.com → Scenarios → mở scenario nhận webhook `1odvra00vo8ejj8r9w9njf1uw6tqcrkr`
2. Xem góc dưới trái: công tắc scheduling đang ON hay OFF
3. Mở tab History → xem lần chạy lúc 21:00 ngày 22/07: có run không, xanh hay đỏ
4. Vào Profile → Usage: còn operations trong tháng không
5. Mở module Facebook trong scenario → Connection → bấm Verify: còn sống không

Ghi lại kết quả 5 mục này. Đây là nguyên nhân gốc, sửa callback mà scenario vẫn tắt thì vẫn không có bài.

---

## Bước 2 — Thêm module gọi về (khi đăng thành công)

Trong scenario, nối THÊM module vào sau module Facebook (nhánh thành công):

1. Bấm dấu + ở cuối module Facebook
2. Chọn `HTTP` → `Make a request`

   Lưu ý: dùng đúng module HTTP thường này, ĐỪNG dùng module "Webhook response" hay app riêng của Make. Trước đây bước callback hay lỗi validation chính vì chọn nhầm loại module.

3. Điền:

| Trường | Giá trị |
|---|---|
| URL | `https://phong-menly-dashboard.vercel.app/api/cron/make-callback` |
| Method | `POST` |
| Headers | Thêm 1 dòng: Name `Authorization`, Value `Bearer <CRON_SECRET>` |
| Body type | `Raw` |
| Content type | `JSON (application/json)` |
| Request content | xem dưới |

Request content:

```json
{
  "postId": {{1.postId}},
  "fbPostId": "{{2.id}}"
}
```

Trong đó `{{1.postId}}` là field `postId` từ module Webhook (module số 1), `{{2.id}}` là ID trả về từ module Facebook (module số 2). Số module có thể khác — bấm vào ô rồi chọn đúng biến từ danh sách Make gợi ý, đừng gõ tay.

4. Bấm OK → Save scenario.

---

## Bước 3 — Thêm nhánh báo lỗi

Để khi Facebook từ chối, dashboard biết ngay thay vì treo:

1. Chuột phải vào module Facebook → `Add error handler`
2. Chọn `HTTP` → `Make a request`, điền y hệt Bước 2 nhưng Request content là:

```json
{
  "postId": {{1.postId}},
  "error": "{{error.message}}"
}
```

3. Sau module này chọn directive `Resume` để scenario không dừng hẳn.

---

## Bước 4 — Chạy thử

1. Trong Make bấm `Run once` (scenario chờ dữ liệu)
2. Trên dashboard, đổi lịch 1 bài về mốc gần nhất, chờ cron 5 phút quét
3. Kết quả đúng phải là:
   - Make History có 1 run xanh
   - Dashboard bài đó chuyển `Đang gửi Make` → `Đã đăng`
   - Mở chi tiết bài thấy có `fb_post_id`
   - Bài xuất hiện trên kênh Telegram cộng đồng

Nếu bài kẹt ở `Đang gửi Make` quá 15 phút, Nhi sẽ nhắn Telegram cảnh báo — lúc đó quay lại Bước 1.

---

## Bước 5 — Bật lại số liệu tương tác (tùy chọn, làm sau)

Khi đã có `fb_post_id` thật, chức năng đồng bộ like/comment mới dùng được. Nhưng nó đi qua Graph API bằng token trong `.env`, mà token đó đang chết. Muốn bật lại thì phải làm token Page mới rồi đặt `FB_INSIGHTS_ENABLED=1`. Chưa cần cho việc đăng bài.
