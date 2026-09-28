// Toggle menu mobile
const navToggle = document.getElementById("navToggle");

if (navToggle) {
  navToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// Đổi trạng thái header khi cuộn trang
const header = document.querySelector(".site-header");

if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 20);
  });
}

// Nút kính lúp trên header — điều hướng tới /tim-kiem/, tự tính đúng path
// tương đối theo độ sâu trang hiện tại. Dùng src của logo (không phải href
// của .brand, vì trên trang chủ .brand cố tình trỏ href="#") — src logo luôn
// đúng dạng "images/logo.webp", "../images/logo.webp" hoặc "../../images/logo.webp".
const searchToggle = document.querySelector('.icon-btn[aria-label="Tìm kiếm"]');
if (searchToggle) {
  searchToggle.addEventListener("click", () => {
    const logo = document.querySelector(".brand img");
    const basePath = logo ? logo.getAttribute("src").replace(/images\/logo\.webp$/, "") : "";
    window.location.href = `${basePath}tim-kiem/`;
  });
}

// Đóng menu mobile khi chọn một mục
document.querySelectorAll(".nav-menu-mobile a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
  });
});

// Submenu "Sản phẩm" trên mobile — bấm để mở/đóng danh sách 3 danh mục
document.querySelectorAll(".mobile-submenu-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const item = toggle.closest(".mobile-item");
    if (!item) return;
    const isOpen = item.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
});

// Trang thanh toán — chọn Tỉnh/Thành rồi tới Phường/Xã, và chọn phương thức thanh toán
const provinceSelect = document.getElementById("provinceSelect");
const wardSelect = document.getElementById("wardSelect");

function resetWardField() {
  if (!wardSelect) return;
  wardSelect.innerHTML = '<option value="">Chọn Tỉnh/Thành trước</option>';
  wardSelect.disabled = true;
}

if (provinceSelect && wardSelect && typeof populateProvinceSelect === "function") {
  populateProvinceSelect(provinceSelect);
  resetWardField();

  provinceSelect.addEventListener("change", () => {
    populateWardField(provinceSelect.value, wardSelect);
  });
}

const bankDetail = document.getElementById("bankDetail");
const momoDetail = document.getElementById("momoDetail");
const paymentConfirmWrap = document.getElementById("paymentConfirmWrap");
const paymentConfirmError = document.getElementById("paymentConfirmError");
const paymentRadios = document.querySelectorAll('input[name="payment-method"]');

if (paymentRadios.length) {
  paymentRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      if (bankDetail) bankDetail.hidden = radio.value !== "bank";
      if (momoDetail) momoDetail.hidden = radio.value !== "momo";
      // Checkbox "Tôi đã chuyển khoản" chỉ hiện với chuyển khoản ngân hàng / MoMo, không hiện với COD
      const needsConfirm = radio.value === "bank" || radio.value === "momo";
      if (paymentConfirmWrap) paymentConfirmWrap.hidden = !needsConfirm;
      const paymentConfirm = document.getElementById("paymentConfirm");
      if (paymentConfirm) paymentConfirm.checked = false;
      if (paymentConfirmError) paymentConfirmError.hidden = true;
    });
  });
}

// FAQ accordion — dùng ở các trang danh mục sản phẩm
document.querySelectorAll(".faq-question").forEach((question) => {
  question.addEventListener("click", () => {
    const item = question.closest(".faq-item");
    if (!item) return;
    const isOpen = item.classList.toggle("is-open");
    question.setAttribute("aria-expanded", String(isOpen));
  });
});

// Gallery ảnh trang chi tiết sản phẩm — bấm thumbnail để đổi ảnh chính
const productMainImage = document.getElementById("productMainImage");
document.querySelectorAll(".product-detail-gallery-thumbs img").forEach((thumb) => {
  thumb.addEventListener("click", () => {
    if (!productMainImage) return;
    productMainImage.src = thumb.dataset.full;
    document
      .querySelectorAll(".product-detail-gallery-thumbs img")
      .forEach((t) => t.classList.remove("is-active"));
    thumb.classList.add("is-active");
  });
});

// Tabs "Mô tả sản phẩm" / "Thông số kỹ thuật" — dùng ở trang chi tiết sản phẩm
document.querySelectorAll(".product-detail-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabs = btn.closest(".product-detail-tabs");
    if (!tabs) return;
    const target = btn.dataset.tabTarget;
    tabs.querySelectorAll(".product-detail-tab-btn").forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", String(isActive));
    });
    tabs.querySelectorAll(".product-detail-tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tab === target);
    });
  });
});

// Hero — crossfade tuần hoàn giữa nhiều clip nền (banner-hero.mp4 -> banner-hero-2.mp4 -> ...)
// Thời điểm bắt đầu fade phải khớp với thời gian transition opacity trong CSS (.hero-video).
const heroVideos = Array.from(document.querySelectorAll(".hero-video"));

// Các clip chưa active dùng preload="none" + data-src (xem index.html) để không tải
// cùng lúc với clip đang chạy — chỉ nạp source thật khi sắp cần đến, đỡ tốn băng thông tải trang.
const loadVideoSource = (video) => {
  const source = video.querySelector("source[data-src]");
  if (!source) return;
  source.src = source.dataset.src;
  delete source.dataset.src;
  video.load();
};

if (heroVideos.length > 1) {
  const FADE_BEFORE_END = 1.2; // giây
  const PRELOAD_BEFORE_END = 5; // giây — đủ thời gian tải clip kế tiếp trước khi cần
  let activeIndex = heroVideos.findIndex((v) => v.classList.contains("is-active"));
  if (activeIndex === -1) activeIndex = 0;
  let isSwitching = false;
  let hasPreloadedNext = false;

  const playVideo = (video) => {
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise) playPromise.catch(() => {});
  };

  const crossfadeTo = (nextIndex) => {
    heroVideos[activeIndex].classList.remove("is-active");
    heroVideos[nextIndex].classList.add("is-active");
    playVideo(heroVideos[nextIndex]);
    activeIndex = nextIndex;
    isSwitching = false;
    hasPreloadedNext = false;
  };

  heroVideos.forEach((video, index) => {
    video.addEventListener("timeupdate", () => {
      if (index !== activeIndex || isSwitching || !video.duration) return;

      const timeLeft = video.duration - video.currentTime;
      const nextIndex = (index + 1) % heroVideos.length;

      if (!hasPreloadedNext && timeLeft <= PRELOAD_BEFORE_END) {
        hasPreloadedNext = true;
        loadVideoSource(heroVideos[nextIndex]);
      }

      if (timeLeft <= FADE_BEFORE_END) {
        isSwitching = true;
        crossfadeTo(nextIndex);
      }
    });
  });

  // Chỉ bắt đầu tải + phát video nền SAU KHI trang đã load xong hoàn toàn (ảnh, CSS, JS),
  // để poster (ảnh tĩnh) hiện ra ngay lập tức và video không cạnh tranh băng thông với
  // nội dung quan trọng của lần tải trang đầu tiên.
  const startHeroPlayback = () => {
    loadVideoSource(heroVideos[activeIndex]);
    playVideo(heroVideos[activeIndex]);
  };

  if (document.readyState === "complete") {
    startHeroPlayback();
  } else {
    window.addEventListener("load", startHeroPlayback, { once: true });
  }
}

// Video dưới fold (vd. clip giới thiệu) — chỉ tải + phát khi cuộn gần tới, tránh
// tải hàng chục MB video ngay từ đầu cho nội dung người dùng chưa chắc đã xem tới.
const lazyVideos = document.querySelectorAll(".lazy-video");

if (lazyVideos.length) {
  if ("IntersectionObserver" in window) {
    const lazyVideoObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const video = entry.target;
          loadVideoSource(video);
          const playPromise = video.play();
          if (playPromise) playPromise.catch(() => {});
          observer.unobserve(video);
        });
      },
      { rootMargin: "200px 0px" }
    );

    lazyVideos.forEach((video) => lazyVideoObserver.observe(video));
  } else {
    // Fallback cho trình duyệt không hỗ trợ IntersectionObserver
    lazyVideos.forEach((video) => {
      loadVideoSource(video);
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {});
    });
  }
}

// Sản phẩm — chuyển tab danh mục (Nguyên liệu / Thi công / Trang trí)
const tabButtons = document.querySelectorAll(".tab-btn");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const panelId = btn.getAttribute("aria-controls");
    const panel = document.getElementById(panelId);
    if (!panel) return;

    tabButtons.forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".product-panel").forEach((p) => {
      p.classList.remove("is-active");
      p.hidden = true;
    });

    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    panel.classList.add("is-active");
    panel.hidden = false;
  });
});

// Tin tức — slider kéo trượt, hiện 4/2/1 thẻ tuỳ breakpoint + nút prev/next + dot
const newsTrack = document.getElementById("newsTrack");
const newsDots = document.getElementById("newsDots");

if (newsTrack && newsDots) {
  const slides = Array.from(newsTrack.children);
  const prevBtn = document.querySelector(".slider-arrow--prev");
  const nextBtn = document.querySelector(".slider-arrow--next");

  const getVisibleCount = () => {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 4;
  };

  const buildDots = () => {
    const visible = getVisibleCount();
    const pageCount = Math.ceil(slides.length / visible);
    newsDots.innerHTML = "";

    for (let i = 0; i < pageCount; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Đến trang ${i + 1}`);
      if (i === 0) dot.classList.add("is-active");
      dot.addEventListener("click", () => {
        newsTrack.scrollTo({ left: i * newsTrack.clientWidth, behavior: "smooth" });
      });
      newsDots.appendChild(dot);
    }
  };

  const updateActiveDot = () => {
    const pageWidth = newsTrack.clientWidth || 1;
    const activeIndex = Math.round(newsTrack.scrollLeft / pageWidth);
    newsDots.querySelectorAll("button").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === activeIndex);
    });
  };

  buildDots();
  newsTrack.addEventListener("scroll", updateActiveDot);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildDots, 200);
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      newsTrack.scrollBy({ left: -newsTrack.clientWidth, behavior: "smooth" });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      newsTrack.scrollBy({ left: newsTrack.clientWidth, behavior: "smooth" });
    });
  }
}

// Fade lên khi cuộn tới — Giới thiệu (trừ video), item Sản phẩm, item Dự án
const revealItems = document.querySelectorAll(".reveal");

if (revealItems.length && "IntersectionObserver" in window) {
  const cardRevealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${(index % 4) * 0.08}s`;
    cardRevealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

// Mosaic gallery — fade-in từng ảnh khi cuộn tới
const mosaicItems = document.querySelectorAll(".mosaic-item");

if (mosaicItems.length && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  mosaicItems.forEach((item, index) => {
    item.style.transitionDelay = `${(index % 4) * 0.08}s`;
    revealObserver.observe(item);
  });
} else {
  mosaicItems.forEach((item) => item.classList.add("is-visible"));
}

// Mosaic gallery — lightbox xem ảnh phóng to, fade in/out
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCaption = document.getElementById("lightboxCaption");
const lightboxClose = document.getElementById("lightboxClose");

if (lightbox && lightboxImg && lightboxCaption && lightboxClose) {
  let lastFocusedTrigger = null;

  const openLightbox = (img, caption, trigger) => {
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || "";
    lightboxCaption.textContent = caption || "";
    lastFocusedTrigger = trigger;
    document.body.classList.add("lightbox-open");
    lightbox.classList.add("is-open");
    lightboxClose.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
    if (lastFocusedTrigger) lastFocusedTrigger.focus();
  };

  mosaicItems.forEach((item) => {
    const img = item.querySelector("img");
    const caption = item.querySelector("figcaption");
    if (!img) return;

    item.setAttribute("tabindex", "0");
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Xem ảnh lớn: ${img.alt || ""}`);

    item.addEventListener("click", () => {
      openLightbox(img, caption ? caption.textContent : "", item);
    });

    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(img, caption ? caption.textContent : "", item);
      }
    });
  });

  lightboxClose.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });
}
