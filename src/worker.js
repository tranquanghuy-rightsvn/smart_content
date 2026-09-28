// API góp ý cho contents.web100.vn. Mọi đường dẫn khác là file tĩnh trong public/.
//
//   GET    /api/comments?page=/<domain>/<slug>/   danh sách góp ý của 1 trang (ai có link cũng xem)
//   POST   /api/comments                          khách thêm góp ý
//   PATCH  /api/comments/:id                      {status:'fixed', reply} cần admin; {status:'open'} ai cũng được (khách thấy chưa đúng)
//   DELETE /api/comments/:id                      khách (hoặc admin) xoá khi đã ưng
//   GET    /api/admin/pages                       admin: các trang đang có góp ý
//   GET    /api/me                                admin key có đúng không
//
// Admin = gửi header X-Admin-Key khớp secret ADMIN_KEY (wrangler secret put ADMIN_KEY).

const NOINDEX = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
const PAGE_RE = /^\/[a-z0-9.-]+\/[a-z0-9-]+\/$/;
const MAX = { quote: 2000, ctx: 60, note: 2000, reply: 1000, author: 60, tag: 40, tags: 10, perPage: 300 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url);
    } catch (err) {
      console.error(err);
      return json({ ok: false, error: 'server_error' }, 500);
    }
  },
};

async function api(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const admin = await isAdmin(request, env);

  if (pathname === '/api/me' && method === 'GET') return json({ ok: true, admin });

  if (pathname === '/api/admin/pages' && method === 'GET') {
    if (!admin) return json({ ok: false, error: 'forbidden' }, 403);
    const { results } = await env.DB.prepare(
      `SELECT page,
              SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END)  AS open,
              SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) AS fixed,
              MAX(updated_at) AS last
         FROM comments GROUP BY page ORDER BY last DESC`
    ).all();
    return json({ ok: true, pages: results });
  }

  if (pathname === '/api/comments' && method === 'GET') {
    const page = url.searchParams.get('page') || '';
    if (!PAGE_RE.test(page)) return json({ ok: false, error: 'invalid_page' }, 400);
    const { results } = await env.DB.prepare(
      'SELECT * FROM comments WHERE page = ? ORDER BY created_at'
    ).bind(page).all();
    return json({ ok: true, items: results.map(out) });
  }

  if (pathname === '/api/comments' && method === 'POST') {
    const b = await body(request);
    if (!b) return json({ ok: false, error: 'invalid_json' }, 400);
    const page = str(b.page, 200);
    if (!PAGE_RE.test(page)) return json({ ok: false, error: 'invalid_page' }, 400);
    // Chỉ nhận góp ý cho trang có thật trong public/ (chặn spam vào đường dẫn bịa)
    const exists = await env.ASSETS.fetch(new Request(new URL(page, url.origin)));
    if (!exists.ok) return json({ ok: false, error: 'page_not_found' }, 404);

    const quote = str(b.quote, MAX.quote).trim();
    const tags = (Array.isArray(b.tags) ? b.tags : []).slice(0, MAX.tags).map((t) => str(t, MAX.tag).trim()).filter(Boolean);
    const note = str(b.note, MAX.note).trim();
    if (!quote) return json({ ok: false, error: 'missing_quote' }, 400);
    if (!note && !tags.length) return json({ ok: false, error: 'missing_note' }, 400);

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM comments WHERE page = ?').bind(page).first('n');
    if (count >= MAX.perPage) return json({ ok: false, error: 'too_many' }, 429);

    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(), page, block: Number.isInteger(b.block) ? b.block : null, quote,
      prefix: str(b.prefix, MAX.ctx), suffix: str(b.suffix, MAX.ctx), tags: JSON.stringify(tags), note,
      author: str(b.author, MAX.author).trim() || 'Khách', status: 'open', reply: '', created_at: now, updated_at: now,
    };
    await env.DB.prepare(
      `INSERT INTO comments (id, page, block, quote, prefix, suffix, tags, note, author, status, reply, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(row.id, row.page, row.block, row.quote, row.prefix, row.suffix, row.tags, row.note, row.author,
      row.status, row.reply, row.created_at, row.updated_at).run();
    return json({ ok: true, item: out(row) }, 201);
  }

  const m = pathname.match(/^\/api\/comments\/([0-9a-f-]{36})$/);
  if (m) {
    const id = m[1];
    const row = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first();
    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    if (method === 'PATCH') {
      const b = await body(request);
      if (!b) return json({ ok: false, error: 'invalid_json' }, 400);
      const status = b.status === 'fixed' || b.status === 'open' ? b.status : row.status;
      let reply = row.reply;
      if (b.reply !== undefined || status === 'fixed') {
        if (!admin) return json({ ok: false, error: 'forbidden' }, 403);
        if (b.reply !== undefined) reply = str(b.reply, MAX.reply).trim();
      }
      const now = new Date().toISOString();
      await env.DB.prepare('UPDATE comments SET status = ?, reply = ?, updated_at = ? WHERE id = ?')
        .bind(status, reply, now, id).run();
      return json({ ok: true, item: out({ ...row, status, reply, updated_at: now }) });
    }
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

function out(r) {
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch { /* dữ liệu hỏng thì coi như không có tag */ }
  return { ...r, tags };
}

async function isAdmin(request, env) {
  const key = request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || !key) return false;
  const a = new TextEncoder().encode(key), b = new TextEncoder().encode(env.ADMIN_KEY);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

async function body(request) {
  try { return await request.json(); } catch { return null; }
}

function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX },
  });
}
