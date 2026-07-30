# Hướng C — Đăng bài bằng Google Sheet (KHÔNG phụ thuộc database)

Cập nhật: 30/07/2026 — ĐÃ CHẠY THÀNH CÔNG END-TO-END (có bài thật lên fanpage, Sheet tự đánh dấu "da dang", Telegram báo).

## Link quan trọng

Google Sheet lịch đăng (dùng cái NÀY):
https://docs.google.com/spreadsheets/d/1pBuc5OpLBmfjpU5aE1fH3P28N17Bhj7eTG9bLRwgaHE/edit

Scenario Make "C. Sheet -> Facebook Auto Post" (id 6758088):
https://eu1.make.com/2112146/scenarios/6758088/edit

Lưu ý: có 1 file Sheet cũ tên giống hệt (tạo lúc đầu, chưa dùng được) — bỏ qua, chỉ dùng link ở trên.

## Luồng đã dựng và kiểm chứng

```
1. Google Sheets - Search Rows   loc Trang thai = "cho dang", lay 1 dong cu nhat
2. Facebook Pages - Create Post   dang anh + noi dung len fanpage Uyen Linh
3. Google Sheets - Update Row     ghi "da dang" + Post ID + gio dang vao dong do
4. HTTP -> Telegram               bao ve @uyennhiCreator_bot
```

Lịch chạy: mỗi ngày 11:00 và 21:00 (giờ VN). Mỗi lần lấy 1 bài.

Bằng chứng đã chạy: dòng test đã tự đổi thành "da dang", Post ID thật = 786094954576493_122169477932967024.

## Bài học kỹ thuật (để sau khỏi mò lại)

Make Google Sheets "Search Rows" xuất các cột theo SỐ THỨ TỰ (bắt đầu từ 0), KHÔNG theo tên cột:

| Cột | Tên | Số trong Make |
|-----|-----|--------------|
| A | Ngay dang | 0 |
| B | Gio dang | 1 |
| C | Pillar | 2 |
| D | Noi dung | 3 |
| E | Link anh | 4 |
| F | Link CTA | 5 |
| G | Trang thai | 6 |
| H | Post ID | 7 |
| I | Ghi chu | 8 |

- Module 2 gọi ảnh: {{1.`4`}}, nội dung: {{1.`3`}}, CTA: {{1.`5`}}
- Module 1 lọc theo chữ cái cột: "G"
- Module 3 ghi theo số: values {"6":"da dang","7":"{{2.id}}","8":"..."}, bắt buộc có valueInputOption = USER_ENTERED

## Cách dùng hàng ngày

Mở Google Sheet, mỗi bài 1 dòng:

| Cột | Điền |
|-----|------|
| Noi dung | Toàn bộ bài viết (xuống dòng Alt+Enter, không markdown) |
| Link anh | Link ảnh public, DƯỚI 4MB (bắt buộc) |
| Link CTA | Link sản phẩm (tự nối cuối bài) |
| Trang thai | Gõ "cho dang" khi muốn đăng. Để trống thì bỏ qua |

Xong tới 11:00 hoặc 21:00 Make tự đăng bài cũ nhất, đổi thành "da dang".

## Để chạy thật (khi có nội dung)

1. Xóa dòng test (dòng đang là "da dang")
2. Điền các bài thật, cột Trang thai = "cho dang"
3. Vào scenario Make, gạt công tắc scheduling sang ON
4. Ảnh phải là link public dưới 4MB

## Việc còn lại (chờ Neon sống 1/08)

- Bơm 3 bài cũ (#31, #32, #17) từ dashboard vào Sheet
- Bật lại bot Telegram + Nhi viết bài
- Nối dashboard tự đẩy bài đã duyệt vào Sheet (khỏi copy tay)

Nhưng luồng Sheet + Make này chạy độc lập, Neon chết không ảnh hưởng.

## Cần dọn

- Trên fanpage Uyên Linh có vài bài TEST (ảnh nền đen chữ vàng "TEST HE THONG") — xóa đi.
