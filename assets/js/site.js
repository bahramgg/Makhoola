/* ماخولا — «نمی‌کاهم» */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- header: solid on scroll, mobile menu, current section */
  const bar = $('#bar'), menuBtn = $('.bar__menu'), navLinks = $$('.bar__nav a');
  const onScroll = () => bar.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const setMenu = (open) => {
    bar.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.innerHTML = `<svg><use href="#i-${open ? 'x' : 'menu'}"/></svg>`;
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => setMenu(!bar.classList.contains('is-open')));
  navLinks.forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.classList.contains('is-open')) setMenu(false); });

  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const id = en.target.id;
      navLinks.forEach((a) => a.classList.toggle('is-here', a.getAttribute('href') === '#' + id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ---------------- reveal on scroll */
  const rev = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); rev.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
  $$('[data-reveal]').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; rev.observe(el); });

  /* ---------------- big section titles drift sideways with the scroll */
  const drifts = $$('[data-drift]');
  let ticking = false;
  const drift = () => {
    ticking = false;
    if (reduce.matches) return;
    const vh = innerHeight;
    for (const el of drifts) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const p = (r.top + r.height / 2) / vh - .5;   // -0.5 … 0.5 across the screen
      el.style.transform = `translate3d(${(p * -9).toFixed(2)}vw,0,0)`;
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
  drift();

  /* ---------------- album title fills the width without overflowing */
  const fitEl = $('.hero__title .fit');
  const fit = () => {
    if (!fitEl) return;
    const h1 = fitEl.parentElement;
    h1.style.fontSize = '';
    const avail = h1.parentElement.clientWidth;
    const w = fitEl.getBoundingClientRect().width;
    if (w > avail) h1.style.fontSize = `${parseFloat(getComputedStyle(h1).fontSize) * avail / w * .98}px`;
  };
  fit();
  addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---------------- hero video: play only while visible */
  const bg = $('.hero__video');
  if (bg) {
    if (reduce.matches) { bg.removeAttribute('autoplay'); bg.pause(); }
    const io = new IntersectionObserver(([en]) => {
      if (reduce.matches || modalOpen) return;
      if (en.isIntersecting) { const p = bg.play(); if (p && p.catch) p.catch(() => {}); } else bg.pause();
    }, { threshold: .05 });
    io.observe(bg);
  }

  /* ---------------- modal: album teaser with sound */
  const modal = $('#modal'), mMedia = $('.modal__media', modal), mTitle = $('.modal__t', modal);
  let modalOpen = false, opener = null;
  function openModal(html, title, from) {
    opener = from || document.activeElement;
    mMedia.innerHTML = html;
    mTitle.textContent = title;
    modal.hidden = false;
    modalOpen = true;
    document.body.style.overflow = 'hidden';
    if (bg) bg.pause();
    $('.modal__x', modal).focus({ preventScroll: true });
  }
  function closeModal() {
    if (!modalOpen) return;
    mMedia.innerHTML = '';
    modal.hidden = true;
    modalOpen = false;
    document.body.style.overflow = '';
    if (bg && !reduce.matches && scrollY < innerHeight) { const p = bg.play(); if (p && p.catch) p.catch(() => {}); }
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  $$('[data-teaser]').forEach((b) => b.addEventListener('click', () => openModal(
    '<video controls autoplay playsinline poster="assets/video/nemikaham-teaser.webp"><source src="assets/video/nemikaham-teaser.webm" type="video/webm"><source src="assets/video/nemikaham-teaser.mp4" type="video/mp4"></video>',
    'تیزر آلبوم «نمی‌کاهم» · ویدیو: هومن فاخته', b)));
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  addEventListener('keydown', (e) => {
    if (!modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'Tab') {   // keep focus inside the dialog
      const f = $$('button, video[controls], iframe', modal);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------------- video section: inline YouTube, clips switch the featured one */
  const player = $('.player'), poster = $('.player__poster');
  const yt = (id) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="ویدیوی ماخولا" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  function playFeatured() {
    const id = poster.dataset.yt;
    const holder = document.createElement('div');
    holder.className = 'player__frame';
    holder.innerHTML = yt(id);
    poster.replaceWith(holder);
  }
  if (poster) poster.addEventListener('click', playFeatured);
  $$('.clips button').forEach((b) => b.addEventListener('click', () => {
    const frame = $('.player__frame', player);
    const id = b.dataset.yt;
    $('.player__k', player).textContent = b.dataset.k;
    $('.player__t', player).textContent = b.dataset.t;
    $('.player__s', player).textContent = b.dataset.s;
    const link = $('.player__link', player);
    link.href = 'https://www.youtube.com/watch?v=' + id;
    $$('.clips button').forEach((x) => x.classList.toggle('is-on', x === b));
    if (frame) frame.innerHTML = yt(id);
    else {
      poster.dataset.yt = id;
      poster.setAttribute('aria-label', `پخش ویدیوی «${b.dataset.t}»`);
      $('img', poster).src = `assets/img/video/${id}.webp`;
      playFeatured();
    }
    player.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });
  }));

  /* ---------------- music shelf: drag to scroll with a mouse */
  const shelf = $('.shelf');
  if (shelf) {
    let d = null;
    shelf.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      d = { x: e.clientX, sl: shelf.scrollLeft, moved: false };
    });
    addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 6) { d.moved = true; shelf.classList.add('is-drag'); }
      if (d.moved) shelf.scrollLeft = d.sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!d) return;
      const moved = d.moved;
      d = null;
      shelf.classList.remove('is-drag');
      if (moved) { const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); }; shelf.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => shelf.removeEventListener('click', stop, { capture: true }), 60); }
    });
    shelf.addEventListener('dragstart', (e) => e.preventDefault());
    const navB = $$('[data-shelf]');
    const state = () => {   // RTL: scrollLeft runs from 0 (start) to a negative number
      const max = shelf.scrollWidth - shelf.clientWidth, x = Math.abs(shelf.scrollLeft);
      navB[0].disabled = x < 4;
      navB[1].disabled = x > max - 4;
    };
    navB.forEach((b) => b.addEventListener('click', () => {
      shelf.scrollBy({ left: -(+b.dataset.shelf) * shelf.clientWidth * .7, behavior: reduce.matches ? 'auto' : 'smooth' });
    }));
    shelf.addEventListener('scroll', state, { passive: true });
    addEventListener('resize', state);
    state();
  }
})();
