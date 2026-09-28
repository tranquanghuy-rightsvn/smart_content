# contents.web100.vn

Trang nháp để khách duyệt nội dung trước khi Web100 đăng lên website chính của khách.
Khách bôi đen chữ (hoặc bấm vào một đoạn) để góp ý: tô màu, in đậm, bỏ đoạn, viết lại...
Web100 mở cùng link là thấy góp ý ngay trên bài, sửa xong bấm "Đã sửa"; khách kiểm tra lại,
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
  admin/index.html             các bài đang có góp ý (nhập admin key), không có link trỏ tới
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

## Admin

- Mở bất kỳ bài nào kèm `?admin=<ADMIN_KEY>` **một lần**: trình duyệt tự nhớ, link tự bỏ phần
  key đi. Sau đó panel góp ý có nhãn "Admin" và nút "✓ Đã sửa" (kèm ghi chú gửi khách).
- Danh sách mọi bài đang có góp ý: `https://contents.web100.vn/admin/` (nhập admin key).
- Khách (không có key) chỉ thêm góp ý, xoá góp ý, và mở lại góp ý đã sửa.

## Cài đặt lần đầu trên Cloudflare (làm 1 lần)

1. Tạo database D1:
   ```bash
   npx wrangler login
   npx wrangler d1 create web100-contents
   ```
   Copy `database_id` in ra, dán vào `wrangler.jsonc` (thay chuỗi `00000000-...`).
2. Tạo bảng trên D1 thật: `npm run db:migrate`
3. Deploy lần đầu và đặt admin key:
   ```bash
   npx wrangler deploy                 # tạo Worker web100-contents + gắn contents.web100.vn
   npx wrangler secret put ADMIN_KEY   # nhập 1 chuỗi dài, khó đoán
   ```
   Domain `web100.vn` đã nằm trên Cloudflare nên `contents.web100.vn` được gắn tự động
   (khai trong `routes` của `wrangler.jsonc`).
4. Tự deploy khi push: Cloudflare Dashboard > Workers & Pages > `web100-contents` > Settings >
   Build > kết nối repo Git này (build command để trống, deploy command `npx wrangler deploy`).

## Chạy thử trên máy

```bash
npm install
npm run db:migrate:local
echo "ADMIN_KEY=local-admin-key" > .dev.vars
npm run dev    # http://localhost:8787/tretruc.com.vn/thi-cong-nha-tre-choi-tre-tron-goi/
```
