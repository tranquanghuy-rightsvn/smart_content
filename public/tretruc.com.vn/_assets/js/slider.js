// Slider ảnh trong thân bài: figure[data-slider]. Trượt bằng scroll-snap (vuốt tự nhiên trên
// điện thoại); nút ‹ ›, tab tên hạng mục và phím ← → chỉ gọi scrollTo. Không tự chạy để khách
// đọc kịp chữ trên ảnh.
document.querySelectorAll('[data-slider]').forEach((slider) => {
  const frame = slider.querySelector('.tv-slider-frame');
  const track = slider.querySelector('.tv-slider-track');
  const slides = [...track.children];
  const tabs = [...slider.querySelectorAll('.tv-slider-tab')];
  const count = slider.querySelector('.tv-slider-count');
  let current = -1;

  const go = (i) => {
    const n = (i + slides.length) % slides.length;
    track.scrollTo({ left: n * track.clientWidth });
  };
  const sync = () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i === current) return;
    current = i;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    });
    tabs.forEach((t, k) => {
      t.classList.toggle('is-active', k === i);
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
    if (count) count.textContent = `${i + 1} / ${slides.length}`;
    // Chỉ cuộn ngang hàng tab (scrollIntoView sẽ kéo cả trang xuống slider)
    const tab = tabs[i], bar = tab && tab.parentElement;
    if (bar) bar.scrollTo({ left: tab.offsetLeft - bar.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
  };

  let raf;
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
  addEventListener('resize', () => { track.scrollTo({ left: current * track.clientWidth, behavior: 'instant' }); });
  slider.querySelector('.tv-slider-btn--prev').addEventListener('click', () => go(current - 1));
  slider.querySelector('.tv-slider-btn--next').addEventListener('click', () => go(current + 1));
  tabs.forEach((t, k) => t.addEventListener('click', () => go(k)));
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  });
  sync();
});
