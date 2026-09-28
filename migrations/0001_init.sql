-- Góp ý của khách trên từng trang nháp.
-- status: open (chờ Web100 sửa) -> fixed (Web100 đã sửa, chờ khách kiểm tra).
-- Khách thấy đúng thì xoá góp ý; thấy chưa đúng thì mở lại (open).
CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  page       TEXT NOT NULL,              -- /tretruc.com.vn/thi-cong-nha-tre-choi-tre-tron-goi/
  block      INTEGER,                    -- thứ tự đoạn trong bài lúc góp ý
  quote      TEXT NOT NULL,              -- đoạn chữ được góp ý
  prefix     TEXT NOT NULL DEFAULT '',   -- vài chữ ngay trước/sau, để tìm đúng chỗ khi đoạn lặp lại
  suffix     TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '[]', -- JSON: ["In đậm", "Tô màu xanh"...]
  note       TEXT NOT NULL DEFAULT '',
  author     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open',
  reply      TEXT NOT NULL DEFAULT '',   -- ghi chú của Web100 khi sửa xong
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_comments_page ON comments (page, created_at);
