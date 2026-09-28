# contents.web100.vn

Trang nháp để khách duyệt nội dung trước khi Web100 đăng lên website chính của khách.
Khách bôi đen chữ (hoặc bấm vào một đoạn) để góp ý: tô màu, in đậm, bỏ đoạn, viết lại...
Editor mở cùng link là thấy góp ý ngay trên bài, sửa xong bấm "Đã sửa"; khách kiểm tra lại,
ưng thì xoá góp ý, chưa ưng thì bấm "Chưa đúng, sửa lại".

- URL bài: `https://contents.web100.vn/<domain>/<slug>/`
  ví dụ `https://contents.web100.vn/tretruc.com.vn/thi-cong-nha-tre-choi-tre-tron-goi/`
- Toàn bộ subdomain **không index, không follow, không lưu cache** (header `X-Robots-Tag` trong
  `public/_headers` + `src/worker.js`, thẻ `<meta name="robots">` trong từng bài). Không có
  sitemap, không có Google Analytics. **Không thêm `robots.txt` chặn (Disallow)**: chặn thì
  Google không đọc được lệnh noindex.

## Cấu trúc

```
public/
  _headers                     noindex cho mọi đường dẫn
  index.html                   trang chủ: chỉ 1 dòng "Trang Smart content của Web100"
  404.html
  _review/review.js, .css      công cụ góp ý, dùng chung cho mọi bài
  <domain>/
    _assets/                   CSS, JS, font copy từ site thật của khách (để bài nháp trông y hệt)
    <slug>/index.html          bài nháp
src/worker.js                  API góp ý (/api/*), lưu trong Cloudflare D1
migrations/                    cấu trúc bảng D1
```

## Thêm một bài nháp mới

1. Tạo `public/<domain>/<slug>/index.html` (copy bài có sẵn của cùng domain rồi thay nội dung).
   Domain mới thì tạo thêm `public/<domain>/_assets/` với CSS/JS/font của site đó.
2. Trong `<head>` phải có:
   ```html
   <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
   <link rel="stylesheet" href="/_review/review.css" />
   ```
   và trước `</body>`: `<script src="/_review/review.js" defer></script>`
3. Đặt `data-review` lên **đúng khối nội dung** cho phép góp ý (header, menu, footer không đặt):
   `<div class="post-detail-body" data-review> ... </div>`
4. `git add`, `commit`, `push` là Cloudflare tự deploy.
5. Gửi link cho khách. Khi khách duyệt xong và bài đã đăng lên site chính, xoá thư mục bài nháp.

## Ai làm được gì

Không có tài khoản, không có trang admin. Ai có link bài nháp đều: thêm góp ý, đọc góp ý, bấm
"✓ Đã sửa" (kèm ghi chú), mở lại ("Chưa đúng, sửa lại") và xoá góp ý.

## Cài đặt trên Cloudflare (đã làm 2026-09-28)

- Database D1 `web100-contents` (ID trong `wrangler.jsonc`) đã tạo và đã có bảng
  (`npm run db:migrate` khi thêm migration mới).
- Worker `smart-content`, kết nối repo Git này (Workers Builds, deploy command `npx wrangler deploy`):
  push là tự deploy.
- **Chưa gắn domain.** Khi sẵn sàng: Dashboard > Workers & Pages > `smart-content` > Settings >
  Domains & Routes > thêm `contents.web100.vn`. Trước đó xem thử qua địa chỉ `*.workers.dev`.

## Chạy thử trên máy

```bash
npm install
npm run db:migrate:local
npm run dev    # http://localhost:8787/tretruc.com.vn/thi-cong-nha-tre-choi-tre-tron-goi/
```
