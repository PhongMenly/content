# Hướng C — Đăng bài bằng Google Sheet (không phụ thuộc database)

Ngày dựng: 30/07/2026

Ý tưởng: Google Sheet là hàng đợi đăng bài. Make đọc Sheet mỗi ngày 2 lần, thấy bài "cho dang" thì đăng lên fanpage rồi tự đánh dấu "da dang". Neon (database) chết cũng không ảnh hưởng — vì luồng này không đụng tới Neon.

## Những thứ đã dựng sẵn (mình làm rồi)

Google Sheet lịch đăng:
https://docs.google.com/spreadsheets/d/1FNb-pygnRYqQwsAZghXepKikLQ7RIA5_AgIfL0gIXgk/edit

Scenario Make "C. Sheet -> Facebook Auto Post":
https://eu1.make.com/2112146/scenarios/6758088/edit

Cấu trúc scenario:
```
1. Google Sheets - Search Rows   (tìm bài "cho dang")  <- CẦN NỐI GOOGLE
2. Facebook Pages - Create Post   (đăng lên fanpage)    <- đã nối sẵn
3. Google Sheets - Update Row     (đánh dấu "da dang")  <- CẦN NỐI GOOGLE
4. HTTP -> Telegram               (báo đã đăng)          <- chạy được luôn
```

Lịch chạy đã đặt: mỗi ngày 11:00 và 21:00 (giờ Việt Nam). Mỗi lần lấy 1 bài cũ nhất đang "cho dang".

## Việc DUY NHẤT anh cần làm: nối tài khoản Google vào Make

Mình không đăng nhập Google hộ anh được, nên bước này anh bấm tay (khoảng 2 phút):

1. Mở link scenario ở trên
2. Bấm vào module số 1 (icon Google Sheets màu xanh lá, tên "Search Rows")
3. Dòng "Connection" → bấm "Add"
4. Hiện cửa sổ đăng nhập Google → chọn tài khoản phongconson@gmail.com → bấm Allow/Cho phép
5. Sau khi nối xong, ngay dưới đó:
   - Spreadsheet: chọn "Lich Dang Fanpage - Uyen Linh"
   - Sheet: chọn tab đầu tiên (thường tên "Lich Dang Fanpage - Uyen Linh" hoặc "Sheet1")
6. Bấm OK
7. Làm y hệt cho module số 3 ("Update a Row") — nhưng ở bước Connection, lần này chọn luôn kết nối Google vừa tạo (không cần Add lại), rồi chọn đúng Spreadsheet + Sheet như trên
8. Bật công tắc scheduling ở góc dưới trái (từ OFF sang ON)

Xong. Từ giờ Make tự lo việc đăng.

## Cách dùng hàng ngày

Mở Google Sheet, điền 1 dòng cho mỗi bài:

| Cột | Điền gì |
|-----|---------|
| Ngay dang | Ngày muốn đăng, dạng 2026-08-02 (chỉ để anh xem, không bắt buộc) |
| Gio dang | Giờ muốn đăng (chỉ để xem) |
| Pillar | Trụ cột nội dung (AI Thuc chien, Kiem tien voi AI...) |
| Noi dung | Toàn bộ bài viết. Xuống dòng bằng Alt+Enter. KHÔNG dùng dấu sao hay markdown |
| Link anh | Link ảnh public (bắt buộc, ảnh dưới 4MB) |
| Link CTA | Link sản phẩm/affiliate, tự nối vào cuối bài |
| Trang thai | Gõ "cho dang" khi muốn Make đăng. Để trống thì Make bỏ qua |
| Post ID | Để trống, Make tự ghi sau khi đăng |
| Ghi chu | Để trống, Make tự ghi |

Nguyên tắc: cứ dòng nào có Trang thai = "cho dang" thì tới giờ (11:00 hoặc 21:00) Make lấy dòng cũ nhất đăng trước, xong đổi thành "da dang". Như xếp hàng.

Nhớ xóa dòng "vi du" màu xám mình để sẵn trước khi dùng thật.

## Khi nào biết bài đã lên

Make đăng xong sẽ nhắn Telegram cho anh (bot @uyennhiCreator_bot vẫn gửi được, không phụ thuộc Neon). Trong Sheet, cột Trang thai đổi thành "da dang" và cột Post ID có số.

## Còn chờ Neon sống lại (dự kiến 1/08)

Khi Neon mở quota lại, mình sẽ làm nốt:
- Bơm 3 bài chưa đăng cũ (#31, #32, #17) từ Neon vào Sheet này
- Bật lại bot Telegram (phần duyệt bài) và Nhi viết bài
- Nối dashboard tự đẩy bài đã duyệt vào Sheet (để anh khỏi copy tay)

Nhưng kể cả không có Neon, luồng Sheet + Make này vẫn tự chạy độc lập.

## Giới hạn cần biết

- Hiện scenario chỉ xử lý bài CÓ ẢNH (đúng kiểu bài Uyên Linh đang đăng). Bài chỉ có chữ không ảnh sẽ cần thêm 1 nhánh — làm sau nếu cần.
- Ảnh phải là link public, dưới 4MB (Facebook giới hạn). Ảnh nặng hơn sẽ lỗi.
