/* Công cụ góp ý nội dung cho contents.web100.vn.
 * Gắn vào trang bằng <script src="/_review/review.js" defer> + <link href="/_review/review.css">.
 * Chỉ vùng có thuộc tính data-review mới góp ý được (header, menu, footer thì không).
 *
 * Luồng: khách bôi đen chữ (hoặc chạm vào 1 đoạn) -> chọn yêu cầu nhanh + ghi chú -> lưu.
 * Editor mở cùng link, đọc góp ý, sửa bài, bấm "Đã sửa" (kèm ghi chú nếu muốn). Không có tài khoản/admin.
 * Khách kiểm tra lại: ưng thì xoá góp ý, chưa ưng thì bấm "Chưa đúng" để mở lại.
 */
(() => {
  'use strict';
  const root = document.querySelector('[data-review]');
  if (!root) return;

  const API = '/api/comments';
  const PAGE = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/';
  const TAGS = ['Tô màu xanh', 'In đậm', 'In nghiêng', 'Bỏ đoạn này', 'Viết lại', 'Sửa chính tả', 'Thêm link', 'Đổi ảnh'];
  // Đoạn chữ góp ý được. Ảnh: <figure> chỉ có ảnh, hoặc khung có data-review-img (vd ảnh trong slider).
  const TEXT_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, td, th';
  const IMG_SEL = 'figure, [data-review-img]';
  const BLOCK_SEL = TEXT_SEL + ', ' + IMG_SEL;
  const isImg = (el) => el.matches(IMG_SEL);
  const MOBILE = matchMedia('(max-width: 900px), (pointer: coarse)');
  const ls = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* chế độ ẩn danh */ } },
  };


  // ---------- helpers ----------
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  };
  const req = async (method, url, data) => {
    const headers = { 'content-type': 'application/json' };
    const res = await fetch(url, { method, headers, body: data ? JSON.stringify(data) : undefined });
    const j = await res.json().catch(() => ({ ok: false, error: 'network' }));
    if (!j.ok) throw new Error(j.error || 'error');
    return j;
  };
  const ago = (iso) => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'vừa xong';
    if (s < 3600) return Math.floor(s / 60) + ' phút trước';
    if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
    return new Date(iso).toLocaleDateString('vi-VN');
  };
  let toastTimer;
  const toast = (msg, bad) => {
    toastEl.textContent = msg;
    toastEl.className = 'rv-toast is-on' + (bad ? ' is-bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'rv-toast'; }, 2600);
  };
  const ERR = { missing_note: 'Chọn ít nhất 1 yêu cầu hoặc ghi chú giúp nhé', network: 'Mất kết nối, thử lại giúp nhé' };

  // ---------- đoạn văn ----------
  let blocks = [];
  const indexBlocks = () => {
    // Chỉ lấy khối trong cùng: <li> chứa <h3>/<p> thì góp ý theo h3/p; <figure> có figcaption/slider thì bỏ
    blocks = [...root.querySelectorAll(BLOCK_SEL)].filter((el) => !el.querySelector(BLOCK_SEL));
    blocks = blocks.filter((el) => !el.closest('.rv-ui'));
    blocks.forEach((el, i) => { el.dataset.rvB = i; el.classList.add('rv-block'); });
  };
  const blockText = (el) => isImg(el) ? '[Ảnh] ' + ((el.querySelector('img') || {}).alt || '') : el.textContent;
  const blockOf = (node) => {
    const el = (node.nodeType === 1 ? node : node.parentElement);
    const b = el && el.closest('.rv-block');
    return b && root.contains(b) ? b : null;
  };

  // Vị trí chữ trong đoạn theo textContent (ổn định, không phụ thuộc CSS)
  const offsetIn = (block, container, offset) => {
    const r = document.createRange();
    r.setStart(block, 0);
    r.setEnd(container, offset);
    return r.toString().length;
  };

  const anchorFromSelection = () => {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const block = blockOf(range.startContainer);
    if (!block || isImg(block)) return null;
    const text = block.textContent;
    let s = offsetIn(block, range.startContainer, range.startOffset);
    let e = block.contains(range.endContainer) ? offsetIn(block, range.endContainer, range.endOffset) : text.length;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e - s < 2) return null;
    return { block: +block.dataset.rvB, quote: text.slice(s, e), prefix: text.slice(Math.max(0, s - 40), s), suffix: text.slice(e, e + 40), el: block };
  };
  const anchorFromBlock = (block) => {
    if (isImg(block)) return { block: +block.dataset.rvB, quote: blockText(block), prefix: '', suffix: '', el: block, whole: true, img: true };
    const text = block.textContent;
    const s = text.search(/\S/), e = text.trimEnd().length;
    return { block: +block.dataset.rvB, quote: text.slice(s, e), prefix: '', suffix: '', el: block, whole: true };
  };

  // Tìm lại đoạn đã góp ý (nội dung có thể đã bị sửa -> trả -1)
  const findIn = (text, c) => {
    let best = -1, bestScore = -1, i = text.indexOf(c.quote);
    while (i !== -1) {
      let score = 0;
      const pre = text.slice(0, i), suf = text.slice(i + c.quote.length);
      for (let k = 1; k <= c.prefix.length && pre.endsWith(c.prefix.slice(-k)); k++) score++;
      for (let k = 1; k <= c.suffix.length && suf.startsWith(c.suffix.slice(0, k)); k++) score++;
      if (score > bestScore) { best = i; bestScore = score; }
      i = text.indexOf(c.quote, i + 1);
    }
    return best;
  };
  const locate = (c) => {
    const order = blocks[c.block] ? [blocks[c.block], ...blocks.filter((b) => b !== blocks[c.block])] : blocks;
    for (const b of order) {
      if (isImg(b)) { if (blockText(b) === c.quote) return { el: b, figure: true }; continue; }
      const i = findIn(b.textContent, c);
      if (i !== -1) return { el: b, start: i, end: i + c.quote.length };
    }
    return null;
  };

  const wrap = (block, start, end, c) => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const parts = [];
    let pos = 0, node;
    while ((node = walker.nextNode())) {
      const len = node.data.length, a = Math.max(start, pos), b = Math.min(end, pos + len);
      if (a < b) parts.push([node, a - pos, b - pos]);
      pos += len;
      if (pos >= end) break;
    }
    const marks = parts.map(([n, a, b]) => {
      const r = document.createRange();
      r.setStart(n, a);
      r.setEnd(n, b);
      const m = h('mark', { class: 'rv-hl rv-' + c.status, 'data-id': c.id });
      r.surroundContents(m);
      return m;
    });
    if (marks.length) marks[marks.length - 1].dataset.n = c.n;
    return marks;
  };
  const clearMarks = () => {
    root.querySelectorAll('mark.rv-hl').forEach((m) => m.replaceWith(...m.childNodes));
    root.querySelectorAll('.rv-fig').forEach((f) => { f.classList.remove('rv-fig', 'rv-open', 'rv-fixed'); delete f.dataset.n; delete f.dataset.id; });
    root.normalize();
  };

  // ---------- state ----------
  let items = [];
  let filter = 'all';
  let activeId = null;

  const paint = () => {
    clearMarks();
    items.forEach((c, i) => { c.n = i + 1; c.lost = false; });
    // Đoạn dài đánh dấu trước để góp ý ngắn nằm bên trong vẫn thấy rõ
    [...items].sort((a, b) => b.quote.length - a.quote.length).forEach((c) => {
      const at = locate(c);
      if (!at) { c.lost = true; return; }
      if (at.figure) { at.el.classList.add('rv-fig', 'rv-' + c.status); at.el.dataset.n = c.n; at.el.dataset.id = c.id; return; }
      wrap(at.el, at.start, at.end, c);
    });
    renderList();
  };

  let lastSig = '';
  const load = async (quiet) => {
    try {
      const j = await req('GET', API + '?page=' + encodeURIComponent(PAGE));
      const sig = JSON.stringify(j.items);
      // Tự tải lại nền: không vẽ lại khi không có gì mới, hoặc khi khách đang bôi đen chữ
      if (quiet && (sig === lastSig || !getSelection().isCollapsed)) return;
      lastSig = sig;
      items = j.items;
      paint();
    } catch (err) {
      if (!quiet) toast('Không tải được góp ý: ' + (ERR[err.message] || err.message), true);
    }
  };

  // ---------- UI ----------
  const toastEl = h('div', { class: 'rv-toast rv-ui', role: 'status' });
  const countEl = h('b');
  const fab = h('button', { class: 'rv-fab rv-ui', type: 'button', onclick: () => openPanel() }, '💬 Góp ý ', countEl);
  // Pop-up hướng dẫn: tự hiện ở lần đầu vào (trình duyệt nhớ), mở lại bằng nút "?" trong danh sách góp ý
  const closeIntro = () => { intro.classList.remove('is-on'); ls.set('rv_intro_seen', '1'); };
  const intro = h('div', { class: 'rv-modal rv-ui', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Hướng dẫn góp ý' },
    h('div', { class: 'rv-backdrop', onclick: closeIntro }),
    h('div', { class: 'rv-sheet rv-intro' },
      h('div', { class: 'rv-intro-icon' }, '📝'),
      h('b', { class: 'rv-intro-title' }, 'Bản nháp để duyệt nội dung'),
      h('ol', { class: 'rv-steps' },
        h('li', {}, h('b', {}, MOBILE.matches ? 'Chạm vào một đoạn' : 'Bôi đen chữ'), MOBILE.matches ? ' (hoặc giữ để bôi đen chữ) rồi bấm "Góp ý".' : ' hoặc bấm vào một đoạn bất kỳ trong bài để góp ý.'),
        h('li', {}, 'Chọn yêu cầu nhanh như ', h('b', {}, 'tô màu, in đậm, bỏ đoạn'), ', hoặc ghi chú thêm.'),
        h('li', {}, 'Editor sẽ sửa và đánh dấu ', h('b', {}, '"Đã sửa"'), '. Bạn kiểm tra lại, ưng thì xoá góp ý đó đi.')),
      h('button', { type: 'button', class: 'rv-btn rv-btn--primary rv-btn--block', onclick: closeIntro }, 'Bắt đầu review')));

  // Nút nổi "Góp ý" cạnh đoạn chọn
  const chip = h('button', { class: 'rv-chip rv-ui', type: 'button', hidden: true });
  let pending = null;
  chip.addEventListener('mousedown', (e) => e.preventDefault()); // giữ nguyên vùng bôi đen
  chip.addEventListener('click', () => { if (pending) openComposer(pending); hideChip(); });
  const showChip = (anchor, rect) => {
    pending = anchor;
    chip.textContent = anchor.img ? '💬 Góp ý ảnh này' : anchor.whole ? '💬 Góp ý đoạn này' : '💬 Góp ý đoạn đã chọn';
    chip.hidden = false;
    if (MOBILE.matches) { chip.classList.add('is-dock'); chip.style.cssText = ''; return; }
    chip.classList.remove('is-dock');
    const top = rect.top + scrollY - 48, left = Math.min(rect.left + scrollX + rect.width / 2, scrollX + innerWidth - 120);
    chip.style.top = Math.max(scrollY + 8, top) + 'px';
    chip.style.left = Math.max(scrollX + 110, left) + 'px';
  };
  const hideChip = () => { chip.hidden = true; pending = null; root.querySelectorAll('.rv-picked').forEach((b) => b.classList.remove('rv-picked')); };

  let selTimer;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      if (composer.classList.contains('is-on')) return;
      const a = anchorFromSelection();
      if (a) {
        root.querySelectorAll('.rv-picked').forEach((b) => b.classList.remove('rv-picked'));
        showChip(a, getSelection().getRangeAt(0).getBoundingClientRect());
      } else if (pending && !pending.whole) hideChip();
    }, 180);
  });
  root.addEventListener('click', (e) => {
    const mark = e.target.closest('mark.rv-hl, .rv-fig');
    if (mark && !getSelection().toString()) { e.preventDefault(); openPanel(mark.dataset.id); return; }
    if (e.target.closest('a') || getSelection().toString().trim()) return;
    const block = blockOf(e.target);
    if (!block) return;
    root.querySelectorAll('.rv-picked').forEach((b) => b.classList.remove('rv-picked'));
    block.classList.add('rv-picked');
    showChip(anchorFromBlock(block), block.getBoundingClientRect());
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.rv-ui, [data-review]')) hideChip(); });

  // Hộp soạn góp ý
  const cQuote = h('blockquote', { class: 'rv-quote' });
  const cTags = h('div', { class: 'rv-tags' }, TAGS.map((t) => h('button', { type: 'button', class: 'rv-tag', onclick: (e) => e.currentTarget.classList.toggle('is-on') }, t)));
  const cNote = h('textarea', { class: 'rv-input', rows: 3, maxlength: 2000, placeholder: 'Ghi chú thêm (ví dụ: đổi thành "..."; màu xanh lá như logo...)' });
  const cName = h('input', { class: 'rv-input', maxlength: 60, placeholder: 'Tên của bạn', value: ls.get('rv_name') });
  const cSave = h('button', { type: 'submit', class: 'rv-btn rv-btn--primary' }, 'Lưu góp ý');
  let composing = null;
  const composer = h('div', { class: 'rv-modal rv-ui', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Góp ý' },
    h('div', { class: 'rv-backdrop', onclick: () => closeComposer() }),
    h('form', { class: 'rv-sheet', onsubmit: (e) => { e.preventDefault(); saveComment(); } },
      h('div', { class: 'rv-sheet-head' }, h('b', {}, 'Góp ý cho đoạn'), h('button', { type: 'button', class: 'rv-x', 'aria-label': 'Đóng', onclick: () => closeComposer() }, '×')),
      cQuote,
      h('label', { class: 'rv-label' }, 'Yêu cầu nhanh (chọn được nhiều)'), cTags,
      h('label', { class: 'rv-label' }, 'Ghi chú'), cNote,
      h('label', { class: 'rv-label' }, 'Người góp ý'), cName,
      h('div', { class: 'rv-row' }, h('button', { type: 'button', class: 'rv-btn', onclick: () => closeComposer() }, 'Huỷ'), cSave)));

  const openComposer = (anchor) => {
    composing = anchor;
    cQuote.textContent = anchor.quote.length > 400 ? anchor.quote.slice(0, 400) + '…' : anchor.quote;
    cTags.querySelectorAll('.is-on').forEach((t) => t.classList.remove('is-on'));
    cNote.value = '';
    composer.classList.add('is-on');
    getSelection().removeAllRanges();
    setTimeout(() => (MOBILE.matches ? null : cNote.focus()), 50);
  };
  const closeComposer = () => { composer.classList.remove('is-on'); composing = null; };
  const saveComment = async () => {
    if (!composing) return;
    const tags = [...cTags.querySelectorAll('.is-on')].map((t) => t.textContent);
    ls.set('rv_name', cName.value.trim());
    cSave.disabled = true;
    try {
      await req('POST', API, { page: PAGE, block: composing.block, quote: composing.quote, prefix: composing.prefix, suffix: composing.suffix, tags, note: cNote.value, author: cName.value });
      closeComposer();
      hideChip();
      toast('Đã lưu góp ý, cảm ơn bạn!');
      await load();
    } catch (err) {
      toast(ERR[err.message] || 'Lưu chưa được: ' + err.message, true);
    } finally {
      cSave.disabled = false;
    }
  };

  // Danh sách góp ý
  const list = h('div', { class: 'rv-list' });
  const tabs = h('div', { class: 'rv-tabs' });
  const panel = h('aside', { class: 'rv-panel rv-ui', 'aria-label': 'Danh sách góp ý' },
    h('div', { class: 'rv-panel-head' },
      h('b', {}, 'Góp ý nội dung'),
      h('button', { type: 'button', class: 'rv-icon', title: 'Hướng dẫn', onclick: () => intro.classList.add('is-on') }, '?'),
      h('button', { type: 'button', class: 'rv-icon', title: 'Tải lại', onclick: () => load() }, '↻'),
      h('button', { type: 'button', class: 'rv-x', 'aria-label': 'Đóng', onclick: () => closePanel() }, '×')),
    tabs, list);
  const openPanel = (id) => {
    panel.classList.add('is-on');
    document.documentElement.classList.add('rv-panel-open');
    if (id) { filter = 'all'; setActive(id, true); }
    renderList();
  };
  const closePanel = () => { panel.classList.remove('is-on'); document.documentElement.classList.remove('rv-panel-open'); setActive(null); };

  const setActive = (id, scrollCard) => {
    activeId = id;
    root.querySelectorAll('.rv-active').forEach((m) => m.classList.remove('rv-active'));
    if (!id) return;
    root.querySelectorAll(`[data-id="${id}"]`).forEach((m) => m.classList.add('rv-active'));
    if (scrollCard) requestAnimationFrame(() => { const card = list.querySelector(`[data-card="${id}"]`); if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  };
  const goTo = (c) => {
    const m = root.querySelector(`[data-id="${c.id}"]`);
    if (!m) return;
    // Góp ý nằm trong câu hỏi FAQ đang đóng (<details>) thì mở ra trước khi cuộn tới
    for (let d = m.closest('details'); d; d = d.parentElement.closest('details')) d.open = true;
    setActive(c.id);
    if (MOBILE.matches) closePanel();
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setActive(c.id);
  };

  const act = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast(okMsg); await load(true); } catch (err) { toast(ERR[err.message] || err.message, true); }
  };
  const confirmBtn = (label, cls, run) => {
    const b = h('button', { type: 'button', class: 'rv-btn rv-btn--sm ' + (cls || '') }, label);
    let armed = false, t;
    b.addEventListener('click', () => {
      if (!armed) { armed = true; b.textContent = 'Bấm lần nữa để chắc chắn'; t = setTimeout(() => { armed = false; b.textContent = label; }, 3000); return; }
      clearTimeout(t);
      run();
    });
    return b;
  };

  const card = (c) => {
    const actions = h('div', { class: 'rv-actions' });
    if (!c.lost) actions.append(h('button', { type: 'button', class: 'rv-btn rv-btn--sm', onclick: () => goTo(c) }, 'Xem trong bài'));
    if (c.status === 'open') {
      const reply = h('textarea', { class: 'rv-input', rows: 2, maxlength: 1000, placeholder: 'Ghi chú khi sửa xong (không bắt buộc)' });
      const box = h('div', { class: 'rv-replybox', hidden: true }, reply,
        h('button', { type: 'button', class: 'rv-btn rv-btn--sm rv-btn--primary', onclick: () => act(() => req('PATCH', API + '/' + c.id, { status: 'fixed', reply: reply.value }), 'Đã đánh dấu sửa xong') }, 'Xác nhận đã sửa'));
      actions.append(h('button', { type: 'button', class: 'rv-btn rv-btn--sm rv-btn--ok', onclick: () => { box.hidden = !box.hidden; if (!box.hidden) reply.focus(); } }, '✓ Đã sửa'));
      actions.append(confirmBtn('Xoá', 'rv-btn--danger', () => act(() => req('DELETE', API + '/' + c.id), 'Đã xoá góp ý')));
      return wrapCard(c, actions, box);
    }
    // Đã sửa: khách kiểm tra lại, ưng thì xoá, chưa ưng thì mở lại
    actions.append(h('button', { type: 'button', class: 'rv-btn rv-btn--sm', onclick: () => act(() => req('PATCH', API + '/' + c.id, { status: 'open' }), 'Đã mở lại, Editor sẽ sửa tiếp') }, 'Chưa đúng, sửa lại'));
    actions.append(confirmBtn('✓ Đã ưng, xoá góp ý', 'rv-btn--ok', () => act(() => req('DELETE', API + '/' + c.id), 'Đã xoá góp ý')));
    return wrapCard(c, actions);
  };
  const wrapCard = (c, actions, extra) => h('div', {
    class: 'rv-card' + (c.id === activeId ? ' is-active' : '') + ' rv-card--' + c.status, 'data-card': c.id,
    onmouseenter: () => setActive(c.id), onclick: (e) => { if (!e.target.closest('button, textarea')) goTo(c); },
  },
    h('div', { class: 'rv-card-top' },
      h('span', { class: 'rv-n' }, String(c.n)),
      h('span', { class: 'rv-status' }, c.status === 'fixed' ? 'Đã sửa, chờ bạn duyệt' : 'Chờ sửa'),
      h('span', { class: 'rv-meta' }, c.author + ' · ' + ago(c.created_at))),
    h('blockquote', { class: 'rv-quote' + (c.lost ? ' is-lost' : '') }, c.quote),
    c.lost ? h('p', { class: 'rv-lost' }, c.status === 'fixed' ? 'Đoạn này đã được viết lại.' : 'Không còn tìm thấy đoạn này trong bài (có thể đã được sửa).') : null,
    c.tags.length ? h('div', { class: 'rv-tags rv-tags--static' }, c.tags.map((t) => h('span', { class: 'rv-tag is-on' }, t))) : null,
    c.note ? h('p', { class: 'rv-note' }, c.note) : null,
    c.reply ? h('p', { class: 'rv-reply' }, h('b', {}, 'Editor: '), c.reply) : null,
    actions, extra || null);

  const renderList = () => {
    const open = items.filter((c) => c.status === 'open').length, fixed = items.length - open;
    countEl.textContent = items.length ? `(${open} chờ sửa${fixed ? ', ' + fixed + ' đã sửa' : ''})` : '';
    fab.classList.toggle('has-fixed', fixed > 0);
    tabs.replaceChildren(...[['all', 'Tất cả', items.length], ['open', 'Chờ sửa', open], ['fixed', 'Đã sửa', fixed]].map(([k, label, n]) =>
      h('button', { type: 'button', class: 'rv-tabbtn' + (filter === k ? ' is-on' : ''), onclick: () => { filter = k; renderList(); } }, `${label} (${n})`)));
    const shown = items.filter((c) => filter === 'all' || c.status === filter);
    list.replaceChildren(...(shown.length ? shown.map(card) : [h('p', { class: 'rv-empty' }, items.length ? 'Không có góp ý nào ở mục này.' : 'Chưa có góp ý nào. Bôi đen chữ hoặc bấm vào một đoạn trong bài để bắt đầu.')]));
  };

  document.body.append(chip, composer, panel, fab, toastEl, intro);
  if (!ls.get('rv_intro_seen')) intro.classList.add('is-on');
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (intro.classList.contains('is-on')) closeIntro(); closeComposer(); hideChip(); } });
  root.querySelectorAll('a[href]').forEach((a) => { a.target = '_blank'; });

  // ---------- khởi động ----------
  indexBlocks();
  (async () => {
    await load();
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
  setInterval(() => { if (!document.hidden && !composer.classList.contains('is-on')) load(true); }, 60000);
})();
