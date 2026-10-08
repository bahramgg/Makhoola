/* ماخولا — Makhoola · interactions (vanilla, no dependencies) */
(() => {
  'use strict';
  window.MK_READY = true;

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header: solid after the fold, hides while scrolling down ---------- */
  const head = $('[data-head]');
  let lastY = scrollY;
  let ticking = false;

  function onScroll() {
    const y = scrollY;
    head.classList.toggle('is-solid', y > 40);
    if (!doc.classList.contains('menu-open')) {
      if (y > lastY + 6 && y > innerHeight * 0.7) head.classList.add('is-hidden');
      else if (y < lastY - 6 || y < innerHeight * 0.7) head.classList.remove('is-hidden');
    }
    lastY = y;
    drawRiver();
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  head.addEventListener('focusin', () => head.classList.remove('is-hidden'));

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('.menu-btn');
  const menu = $('#menu');
  const menuLabel = $('.menu-btn__label', menuBtn);

  function setMenu(open) {
    doc.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'بستن' : 'منو';
    if (open) {
      head.classList.remove('is-hidden');
      setTimeout(() => $('a', menu).focus({ preventScroll: true }), 300);
    }
  }
  menuBtn.addEventListener('click', () => setMenu(!doc.classList.contains('menu-open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && doc.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); }
  });

  /* ---------- Reveal on scroll ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  $$('.reveal, [data-reveal-self]').forEach((el) => revealIO.observe(el));

  /* ---------- Active section in the nav ---------- */
  const navLinks = $$('.nav a');
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.hash === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.map((a) => $(a.hash)).filter(Boolean).forEach((s) => navIO.observe(s));

  /* ---------- Hero: pause the living emblem when it is off-screen ---------- */
  const hero = $('.hero');
  new IntersectionObserver(([en]) => hero.classList.toggle('is-off', !en.isIntersecting)).observe(hero);

  /* ---------- The river: «از سنگ به سنگ» ---------- */
  const river = $('.river');
  const riverSvg = $('.river__svg');
  const flow = $('.river__svg .flow');
  const bank = $('.river__svg .bank');
  let riverLen = 0;

  function buildRiver() {
    const stones = $$('.year:not([hidden]) .year__stone', river);
    const box = riverSvg.getBoundingClientRect();
    if (!stones.length || !box.width) { riverLen = 0; flow.removeAttribute('d'); bank.removeAttribute('d'); return; }
    const w = box.width;
    const H = river.getBoundingClientRect().height;
    const pts = stones.map((s) => {
      const r = s.getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    });
    let prev = [pts[0][0], 0];
    let d = `M${prev[0].toFixed(1)} 0`;
    pts.forEach((p, i) => {
      const dy = p[1] - prev[1];
      const sway = (i % 2 ? 1 : -1) * w * 0.42;
      d += ` C${(prev[0] + sway).toFixed(1)} ${(prev[1] + dy * 0.38).toFixed(1)} ${(p[0] - sway).toFixed(1)} ${(p[1] - dy * 0.38).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      prev = p;
    });
    const tail = H - prev[1];
    d += ` C${(prev[0] + w * 0.4).toFixed(1)} ${(prev[1] + tail * 0.4).toFixed(1)} ${(prev[0] - w * 0.35).toFixed(1)} ${(H - tail * 0.2).toFixed(1)} ${prev[0].toFixed(1)} ${H.toFixed(1)}`;
    flow.setAttribute('d', d);
    bank.setAttribute('d', d);
    riverLen = flow.getTotalLength();
    flow.style.strokeDasharray = `${riverLen} ${riverLen}`;
    drawRiver();
  }

  function drawRiver() {
    if (!riverLen) return;
    if (reduceMotion) { flow.style.strokeDashoffset = '0'; return; }
    const r = river.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (innerHeight * 0.72 - r.top) / r.height));
    flow.style.strokeDashoffset = String(riverLen * (1 - progress));
  }

  let riverTimer;
  const queueRiver = () => { clearTimeout(riverTimer); riverTimer = setTimeout(buildRiver, 120); };
  if ('ResizeObserver' in window) new ResizeObserver(queueRiver).observe(river);
  addEventListener('load', buildRiver);
  if (document.fonts) document.fonts.ready.then(queueRiver);

  /* ---------- City filter for the live archive ---------- */
  const filters = $$('.filter');
  filters.forEach((btn) => btn.addEventListener('click', () => {
    const city = btn.dataset.city;
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $$('.year', river).forEach((year) => {
      let any = false;
      $$('.show', year).forEach((show) => {
        const on = city === 'all' || show.dataset.city === city;
        show.hidden = !on;
        if (on) { any = true; show.classList.add('is-in'); }
      });
      year.hidden = !any;
    });
    buildRiver();
  }));

  /* ---------- Lightbox (posters + photos) ---------- */
  const dlg = $('.lightbox');
  const dImg = $('.lightbox__stage img', dlg);
  const dCap = $('.lightbox__cap', dlg);
  let group = [];
  let idx = 0;

  function showItem(i) {
    idx = (i + group.length) % group.length;
    const el = group[idx];
    const thumb = $('img', el);
    dImg.src = el.dataset.full;
    dImg.alt = thumb ? thumb.alt : '';
    const [title, ...rest] = (el.dataset.cap || '').split(' · ');
    const b = document.createElement('b');
    b.textContent = title;
    dCap.replaceChildren(b, document.createTextNode(rest.join(' · ')));
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-lightbox]');
    if (!trigger || typeof dlg.showModal !== 'function') return;
    group = $$(`[data-lightbox="${trigger.dataset.lightbox}"]`).filter((el) => !el.closest('[hidden]'));
    showItem(group.indexOf(trigger));
    dlg.showModal();
  });
  $('.lightbox__close', dlg).addEventListener('click', () => dlg.close());
  $('.lightbox__prev', dlg).addEventListener('click', () => showItem(idx - 1));
  $('.lightbox__next', dlg).addEventListener('click', () => showItem(idx + 1));
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.classList.contains('lightbox__stage')) dlg.close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showItem(idx + 1);   // RTL: left = next
    if (e.key === 'ArrowRight') showItem(idx - 1);
  });

  /* ---------- Lite YouTube: the iframe loads only on click ---------- */
  $$('[data-yt]').forEach((btn) => btn.addEventListener('click', () => {
    const frame = btn.closest('.video__frame');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0`;
    iframe.title = btn.getAttribute('aria-label');
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    frame.append(iframe);
    btn.closest('.video').classList.add('is-playing');
    iframe.focus();
  }));

  /* ---------- Horizontal scrollers: buttons + mouse drag ---------- */
  $$('[data-scroller]').forEach((nav) => {
    const scroller = $(nav.dataset.scroller);
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-dir]');
      if (!b) return;
      const dir = b.dataset.dir === 'next' ? -1 : 1; // RTL: "next" moves toward the left
      scroller.scrollBy({ left: dir * scroller.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  $$('.strip, .shelf').forEach((scroller) => {
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    scroller.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = scroller.scrollLeft;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; scroller.classList.add('is-drag'); }
      if (moved) scroller.scrollLeft = startLeft - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      scroller.classList.remove('is-drag');
    });
    scroller.addEventListener('click', (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  });
})();
