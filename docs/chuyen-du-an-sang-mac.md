# Hướng dẫn chuyển dự án Content Studio sang máy Mac

> Lưu ý quan trọng: 90% hệ thống đã chạy trên cloud (dashboard Vercel + database Neon + bot Telegram webhook + cron tự đăng). Máy Mac chỉ cần cho 2 việc: (1) làm việc với Claude Code để phát triển tiếp, (2) chạy tính năng chia sẻ Facebook Group (cần trình duyệt thật).

## Bước 1 — Đưa code lên GitHub (làm trên máy Windows này, 1 lần)

1. Vào github.com → New repository → tên `content-studio` → chọn **Private** → Create
2. Chạy 2 lệnh (thay `TEN_TAI_KHOAN` bằng username GitHub của bạn):
```
git remote add origin https://github.com/TEN_TAI_KHOAN/content-studio.git
git push -u origin main
```
(Hoặc đưa link repo cho Claude, Claude push giúp.)

## Bước 2 — Chuyển file bí mật (KHÔNG nằm trong GitHub)

Các file sau bị gitignore vì chứa mật khẩu/token — phải tự chép qua Mac (AirDrop, USB, hoặc trình quản lý mật khẩu):

| File | Chứa gì |
|------|---------|
| `dashboard/.env.local` | Mật khẩu dashboard, API token, Neon DB, token Facebook Page, Telegram |
| `telegram-bot/.env` | Token bot Telegram, Kyma API key |
| `facebook-bot/.env` | Token Facebook Page |
| `.env` (gốc) | Các key chung |

TUYỆT ĐỐI không gửi các file này qua chat/email công khai.

## Bước 3 — Cài đặt trên máy Mac

```bash
# 1. Cài Homebrew (nếu chưa có)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Cài công cụ
brew install git node
npm install -g pm2 vercel @anthropic-ai/claude-code

# 3. Kéo code về
git clone https://github.com/TEN_TAI_KHOAN/content-studio.git
cd content-studio

# 4. Chép các file .env đã chuyển ở Bước 2 vào đúng vị trí

# 5. Cài thư viện
cd dashboard && npm install && cd ..
cd facebook-bot && npm install && cd ..
cd telegram-bot && npm install && cd ..

# 6. Đăng nhập Vercel (để deploy được)
vercel login
```

## Bước 4 — Những gì KHÔNG cần làm lại trên Mac

- Dashboard, bot Telegram, cron tự đăng, backup: đã chạy trên Vercel 24/7, không phụ thuộc máy nào
- Database: nằm trên Neon cloud, 2 máy dùng chung
- Kho ảnh: nằm trên Vercel Blob

## Bước 5 — Những gì cần làm lại trên Mac (chỉ khi dùng chia sẻ Group)

```bash
cd facebook-bot
node share-groups.js --setup   # Edge/Chrome mở ra, đăng nhập Facebook 1 lần
pm2 start ../dashboard/ecosystem.config.js --only phong-cron
pm2 save && pm2 startup        # tự khởi động cùng máy (làm theo lệnh nó in ra)
```
Lưu ý: script đã hỗ trợ sẵn Edge và Chrome trên macOS. Sửa đường dẫn `cwd` trong `ecosystem.config.js` từ `d:/Content-Creation-Template/...` thành đường dẫn trên Mac (ví dụ `/Users/ten-ban/content-studio/...`).

## Bước 6 — Claude Code trên Mac

- Mở thư mục dự án bằng Claude Code là chạy được ngay: file CLAUDE.md (bộ não thương hiệu) nằm trong repo nên đi theo code
- Bộ nhớ làm việc của Claude (memory) nằm ngoài repo tại `~/.claude/projects/...` trên máy Windows — nếu muốn Claude trên Mac nhớ toàn bộ quy trình, chép thư mục memory đó sang vị trí tương ứng trên Mac, hoặc đơn giản nói Claude đọc lại file này + CLAUDE.md

## Quy tắc làm việc 2 máy

- Trước khi làm việc: `git pull`
- Sau khi sửa xong: `git add -A && git commit -m "..." && git push`
- Sửa code dashboard xong phải `vercel deploy --prod --yes` (trong thư mục dashboard/) để bản cloud cập nhật
- Không sửa cùng lúc trên 2 máy để tránh xung đột
