/* ماخولا — بدون کتابخانه */
(() => {
  'use strict';
  window.MK = true;
  const doc = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const small = () => innerWidth < 700;
  const onVisible = (el, cb, margin = '120px') => {
    const io = new IntersectionObserver(([en]) => cb(en.isIntersecting), { rootMargin: margin });
    io.observe(el);
  };

  /* ---------------- نوار بالا و منو ---------------- */
  const bar = $('[data-bar]');
  const menuBtn = $('.bar__menu');
  let lastY = scrollY;
  let ticking = false;
  const scrollJobs = [];
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      bar.classList.toggle('is-solid', y > innerHeight * 0.6);
      if (!doc.classList.contains('index-open')) bar.classList.toggle('is-hidden', y > lastY + 4 && y > innerHeight);
      if (y < lastY - 4) bar.classList.remove('is-hidden');
      scrollJobs.forEach((f) => f(y, y - lastY));
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
  bar.addEventListener('focusin', () => bar.classList.remove('is-hidden'));
  const setIndex = (open) => {
    doc.classList.toggle('index-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'بستن' : 'منو';
  };
  menuBtn.addEventListener('click', () => setIndex(!doc.classList.contains('index-open')));
  $$('#index a').forEach((a) => a.addEventListener('click', () => setIndex(false)));
  const navLinks = $$('.bar__nav a');
  const navIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('on', a.hash === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  navLinks.map((a) => $(a.hash)).filter(Boolean).forEach((s) => navIO.observe(s));

  /* ---------------- ظاهر شدن ---------------- */
  const rvIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); rvIO.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.s-new__body > *, .s-music__head, .rel, .s-rooster__info, .s-live__head > *, .archive__top, .stage, .s-band__bio > *, .member, .s-band__more, .s-photos__title, .join, .platforms li, .s-contact__cols > div')
    .forEach((el) => { el.classList.add('rv'); rvIO.observe(el); });

  /* ---------------- موج‌های رود، پشت نشان ---------------- */
  const hero = $('.s-hero');
  const wc = $('.waves');
  if (wc) {
    const ctx = wc.getContext('2d');
    let W = 0, H = 0, lines = [], run = false, t = 0, frame = 0, ptr = null, raf = 0;
    const DPR = Math.min(devicePixelRatio || 1, small() ? 1 : 1.5);
    const build = () => {
      W = hero.clientWidth; H = hero.clientHeight; grad = null;
      wc.width = Math.round(W * DPR); wc.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = small() ? 26 : 44;
      lines = Array.from({ length: n }, (_, i) => {
        const f = i / (n - 1);
        const mid = 1 - Math.abs(f - 0.5) * 2;
        const jit = Array.from({ length: 64 }, () => (Math.random() - 0.5) * 2.2);
        return { y: H * (0.06 + f * 0.9), a: 6 + mid * 16, k: 0.004 + Math.random() * 0.004, s: 0.35 + Math.random() * 0.5, p: Math.random() * 6.28, alpha: 0.06 + mid * mid * 0.46, w: 0.8 + mid * 0.9, jit };
      });
    };
    let grad = null;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const step = small() ? 18 : 14;
      if (!grad) {
        grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(74, 102, 168, 0)');
        grad.addColorStop(0.22, 'rgba(74, 102, 168, 1)');
        grad.addColorStop(0.78, 'rgba(74, 102, 168, 1)');
        grad.addColorStop(1, 'rgba(74, 102, 168, 0)');
      }
      ctx.strokeStyle = grad;
      for (const L of lines) {
        ctx.beginPath();
        let j = 0;
        for (let x = -10; x <= W + 10; x += step, j++) {
          let y = L.y + Math.sin(x * L.k + t * L.s + L.p) * L.a + Math.sin(x * L.k * 2.3 - t * L.s * 0.7 + L.p * 1.7) * L.a * 0.35 + L.jit[j & 63];
          if (ptr) {
            const dx = x - ptr.x; const dy = L.y - ptr.y;
            const g = Math.exp(-(dx * dx) / 9000 - (dy * dy) / 5200);
            y += (dy >= 0 ? 1 : -1) * g * 34;
          }
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = L.alpha;
        ctx.lineWidth = L.w;
        ctx.stroke();
      }
    };
    const loop = () => {
      raf = 0;
      if (!run) return;
      frame++;
      if (frame % 2 === 0) { t += 0.033; draw(); }
      raf = requestAnimationFrame(loop);
    };
    build(); draw();
    if (!reduce) {
      onVisible(hero, (v) => { run = v; if (v && !raf) raf = requestAnimationFrame(loop); }, '0px');
      hero.addEventListener('pointermove', (e) => { const b = hero.getBoundingClientRect(); ptr = { x: e.clientX - b.left, y: e.clientY - b.top }; });
      hero.addEventListener('pointerleave', () => { ptr = null; });
    }
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); draw(); }, 150); });
  }

  /* ---------------- نشان: حروف ریز جمع می‌شوند و از ماوس می‌گریزند ---------------- */
  const emblem = $('.emblem');
  if (emblem && !reduce) {
    const gl = $$('.g', emblem).map((el) => ({ el, cx: +el.dataset.cx, cy: +el.dataset.cy, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 }));
    gl.forEach((g, i) => {
      const a = (i / gl.length) * 6.283 + Math.random();
      g.x = Math.cos(a) * (220 + Math.random() * 160);
      g.y = Math.sin(a) * (220 + Math.random() * 160);
      g.r = (Math.random() - 0.5) * 160;
    });
    let ptr = null, raf = 0;
    const step = () => {
      let energy = 0;
      for (const g of gl) {
        if (ptr) {
          const dx = g.cx + g.x - ptr.x; const dy = g.cy + g.y - ptr.y; const d = Math.hypot(dx, dy) || 1;
          if (d < 180) { const f = (1 - d / 180) ** 2 * 10; g.vx += (dx / d) * f; g.vy += (dy / d) * f; g.vr += f * 0.6; }
        }
        g.vx = (g.vx - g.x * 0.04) * 0.86; g.vy = (g.vy - g.y * 0.04) * 0.86; g.vr = (g.vr - g.r * 0.04) * 0.86;
        g.x += g.vx; g.y += g.vy; g.r += g.vr;
        energy += Math.abs(g.vx) + Math.abs(g.vy) + Math.abs(g.x) * 0.01 + Math.abs(g.y) * 0.01;
        g.el.style.transform = `translate(${g.x.toFixed(1)}px, ${g.y.toFixed(1)}px) rotate(${g.r.toFixed(1)}deg)`;
      }
      raf = (energy > 0.08 || ptr) ? requestAnimationFrame(step) : 0;
    };
    step();
    setTimeout(() => { if (!raf) raf = requestAnimationFrame(step); }, 500);
    const toSvg = (e) => { const m = emblem.getScreenCTM(); if (!m) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: p.x, y: p.y }; };
    hero.addEventListener('pointermove', (e) => { ptr = toSvg(e); if (!raf) raf = requestAnimationFrame(step); });
    hero.addEventListener('pointerleave', () => { ptr = null; });
    hero.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') ptr = null; });
  }

  /* ---------------- نمی‌کاهم: حرکت آرام نقاشی ---------------- */
  const newArt = $('.s-new__art img');
  if (newArt && !reduce) {
    const sec = $('.s-new');
    scrollJobs.push(() => {
      const r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      newArt.style.transform = `translateY(${(p * 60).toFixed(1)}px) scale(1.12)`;
    });
  }

  /* ---------------- آثار: باز و بسته شدن، و جلدی که دنبال ماوس می‌آید ---------------- */
  const disc = $('.disc');
  if (disc) {
    $$('.rel__row', disc).forEach((btn) => btn.addEventListener('click', () => {
      const li = btn.closest('.rel');
      const more = $('.rel__more', li);
      const open = !li.classList.contains('open');
      li.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      more.hidden = !open;
      if (open) hc.classList.remove('on');
    }));
    const hc = $('.hover-cover');
    if (fine && hc && !reduce) {
      let tx = 0, ty = 0, x = 0, y = 0, raf = 0, active = false;
      const follow = () => {
        x += (tx - x) * 0.16; y += (ty - y) * 0.16;
        const rot = Math.max(-12, Math.min(12, (tx - x) * 0.08));
        hc.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
        raf = (active || Math.abs(tx - x) > 0.5) ? requestAnimationFrame(follow) : 0;
      };
      disc.addEventListener('pointermove', (e) => {
        const li = e.target.closest('.rel');
        const onRow = e.target.closest('.rel__row');
        if (!li || !onRow || li.classList.contains('open')) { hc.classList.remove('on'); active = false; return; }
        if (hc.dataset.src !== li.dataset.cover) { hc.src = li.dataset.cover; hc.dataset.src = li.dataset.cover; }
        const w = hc.offsetWidth;
        tx = e.clientX - w * 0.5 - (e.clientX > innerWidth / 2 ? w * 0.75 : -w * 0.75);
        ty = e.clientY - w * 0.5;
        if (!active) { if (!hc.classList.contains('on')) { x = tx; y = ty; } active = true; hc.classList.add('on'); }
        if (!raf) raf = requestAnimationFrame(follow);
      });
      disc.addEventListener('pointerleave', () => { hc.classList.remove('on'); active = false; });
    }
  }

  /* ---------------- رود: شعر روی موج ---------------- */
  const lines = [];
  let uid = 0;
  const river = $('.river');
  const buildRiver = () => {
    if (!river) return;
    lines.length = 0;
    const W = river.clientWidth; const H = river.clientHeight;
    if (!W || !H) return;
    river.querySelector('svg')?.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    river.prepend(svg);
    const k = W < 700 ? 2.1 : 1;
    $$('p.rl', river).forEach((p) => {
      const y = (+p.dataset.y / 100) * H;
      const size = Math.max(15, (+p.dataset.size / 100) * W * k);
      const amp = (+p.dataset.amp / 100) * W * (W < 700 ? 1.6 : 1);
      const wave = (+p.dataset.wave / 100) * W * (W < 700 ? 1.4 : 1);
      const ph = +p.dataset.phase || 0;
      let d = '';
      for (let x = -0.06 * W; x <= 1.06 * W; x += Math.max(6, W / 180)) {
        const yy = y + Math.sin((x / wave) * 6.2832 + ph) * amp + Math.sin((x / (wave * 2.3)) * 6.2832 + ph * 1.7) * amp * 0.4;
        d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`;
      }
      const id = `rl${uid++}`;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('id', id); path.setAttribute('d', d); path.setAttribute('fill', 'none');
      svg.appendChild(path);
      const words = `${p.textContent.trim()} `;
      const probe = document.createElementNS(NS, 'text');
      probe.setAttribute('font-size', size.toFixed(1)); probe.textContent = words; svg.appendChild(probe);
      const seg = probe.getComputedTextLength() || size * words.length * 0.4;
      probe.remove();
      const len = path.getTotalLength();
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('font-size', size.toFixed(1));
      text.setAttribute('class', p.className.replace('rl ', ''));
      const tp = document.createElementNS(NS, 'textPath');
      tp.setAttribute('href', `#${id}`);
      tp.textContent = words.repeat(Math.ceil((len + seg) / seg) + 1);
      text.appendChild(tp); svg.appendChild(text);
      const L = { tp, len, seg, off: (ph / 6.28) * seg, speed: +p.dataset.speed || 6 };
      tp.setAttribute('startOffset', (len + L.off).toFixed(1));
      lines.push(L);
    });
  };
  if (river && !reduce) {
    let vis = false, boost = 0, last = performance.now(), raf = 0, fr = 0;
    scrollJobs.push((y, dy) => { boost = Math.min(8, boost + Math.abs(dy) * 0.03); });
    const flow = (now) => {
      raf = 0;
      if (!vis) return;
      const dt = Math.min(0.06, (now - last) / 1000); last = now;
      boost *= Math.pow(0.08, dt);
      if (++fr % 2 === 0) {
        for (const L of lines) {
          L.off = (((L.off + L.speed * 6.4 * (1 + boost) * dt) % L.seg) + L.seg) % L.seg;
          L.tp.setAttribute('startOffset', (L.len + L.off).toFixed(1));
        }
      }
      raf = requestAnimationFrame(flow);
    };
    onVisible(river, (v) => { vis = v; if (v && !raf) { last = performance.now(); raf = requestAnimationFrame(flow); } });
  }

  /* ---------------- نمایشگر ---------------- */
  const viewer = $('.viewer');
  const vImg = $('img', viewer);
  const vCap = $('figcaption', viewer);
  let group = [], gi = 0, opener = null;
  const show = (i) => {
    gi = (i + group.length) % group.length;
    vImg.src = group[gi].dataset.full;
    vImg.alt = '';
    vCap.textContent = group[gi].dataset.cap || '';
  };
  const openViewer = (el, list) => {
    group = list; opener = el;
    viewer.classList.toggle('single', list.length < 2);
    show(list.indexOf(el));
    viewer.hidden = false; doc.classList.add('viewer-open');
    $('.viewer__close').focus();
  };
  const closeViewer = () => { viewer.hidden = true; doc.classList.remove('viewer-open'); vImg.removeAttribute('src'); if (opener) opener.focus({ preventScroll: true }); };
  $('.viewer__close').addEventListener('click', closeViewer);
  $('.viewer__prev').addEventListener('click', () => show(gi - 1));
  $('.viewer__next').addEventListener('click', () => show(gi + 1));
  viewer.addEventListener('click', (e) => { if (e.target === viewer || e.target.tagName === 'FIGURE') closeViewer(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!viewer.hidden) closeViewer(); else if (doc.classList.contains('index-open')) { setIndex(false); menuBtn.focus(); } }
    if (!viewer.hidden && group.length > 1) { if (e.key === 'ArrowLeft') show(gi + 1); if (e.key === 'ArrowRight') show(gi - 1); }
  });

  /* ---------------- اجراها: فیلتر، پیش‌نمایش پوستر ---------------- */
  const showsList = $('.shows');
  if (showsList) {
    const items = $$('.show', showsList);
    const pImg = $('.preview img');
    const pCap = $('.preview__cap');
    let cur = null;
    const preview = (li) => {
      if (!li || li === cur || !li.dataset.full) return;
      cur?.classList.remove('on'); cur = li; li.classList.add('on');
      pImg.classList.add('swap');
      const src = li.dataset.full;
      setTimeout(() => { pImg.onload = () => pImg.classList.remove('swap'); pImg.src = src; pCap.textContent = li.dataset.cap || ''; if (pImg.complete) pImg.classList.remove('swap'); }, 120);
    };
    const years = () => {
      $$('.show__year', showsList).forEach((y) => y.remove());
      const seen = new Set();
      items.forEach((li) => {
        if (li.hidden) return;
        const yr = li.dataset.year;
        if (seen.has(yr)) return;
        seen.add(yr);
        const sp = document.createElement('span');
        sp.className = 'show__year'; sp.setAttribute('aria-hidden', 'true');
        sp.textContent = yr.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
        li.prepend(sp);
      });
    };
    $$('.chip').forEach((chip) => chip.addEventListener('click', () => {
      const c = chip.dataset.city;
      $$('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
      items.forEach((li) => { li.hidden = !(c === 'all' || li.dataset.city === c); });
      years();
      preview(items.find((li) => !li.hidden && li.dataset.full));
    }));
    if (fine) {
      showsList.addEventListener('pointerover', (e) => preview(e.target.closest('.show')));
      showsList.addEventListener('focusin', (e) => preview(e.target.closest('.show')));
    }
    showsList.addEventListener('click', (e) => {
      const li = e.target.closest('.show');
      if (!li || !li.dataset.full) return;
      openViewer(li, items.filter((x) => !x.hidden && x.dataset.full));
    });
    years();
    preview(items.find((li) => li.dataset.full));
  }

  /* ---------------- ویدیو ---------------- */
  const stage = $('.stage');
  if (stage) {
    const sImg = $('.stage__img', stage);
    const sScreen = $('.stage__screen', stage);
    const capB = $('.stage__cap b', stage);
    const capS = $('.stage__cap span', stage);
    const reel = $$('.reel__item');
    let currentYt = reel[0]?.dataset.yt;
    const select = (btn, play) => {
      reel.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      currentYt = btn.dataset.yt;
      $('iframe', sScreen)?.remove();
      stage.classList.remove('playing');
      sImg.src = $('img', btn).src;
      capB.textContent = btn.dataset.title; capS.textContent = btn.dataset.meta;
      if (play) start();
    };
    const start = () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${currentYt}?autoplay=1&rel=0`;
      f.title = capB.textContent;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      sScreen.append(f);
      stage.classList.add('playing');
    };
    reel.forEach((b) => b.addEventListener('click', () => select(b, stage.classList.contains('playing'))));
    $('.stage__play', stage).addEventListener('click', start);
    if (reel[0]) select(reel[0], false);
  }

  /* ---------------- چهره‌ها: چاپ نقطه‌ای سفید ---------------- */
  class Dots {
    constructor(c) {
      this.c = c; this.ctx = c.getContext('2d'); this.m = null; this.loop = 0; this.ready = false;
      const img = new Image();
      img.onload = () => { this.img = img; this.build(); };
      img.src = c.dataset.map;
      const pt = (e) => { const b = c.getBoundingClientRect(); this.m = { x: e.clientX - b.left, y: e.clientY - b.top }; this.kick(); };
      c.addEventListener('pointermove', pt);
      c.addEventListener('pointerdown', pt);
      c.addEventListener('pointerleave', () => { this.m = null; this.kick(); });
      c.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { this.m = null; this.kick(); } });
    }
    build() {
      const w = this.c.clientWidth; const h = this.c.clientHeight;
      if (!w || !this.img) return;
      const DPR = Math.min(devicePixelRatio || 1, 2);
      this.w = w; this.h = h; this.c.width = Math.round(w * DPR); this.c.height = Math.round(h * DPR);
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cols = Math.round(Math.min(96, Math.max(44, w / 3.4)));
      const cell = w / cols; const rows = Math.round(h / cell);
      const off = document.createElement('canvas'); off.width = cols; off.height = rows;
      const o = off.getContext('2d', { willReadFrequently: true });
      o.drawImage(this.img, 0, 0, cols, rows);
      const data = o.getImageData(0, 0, cols, rows).data;
      const hx = [], hy = [], rr = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const v = data[(j * cols + i) * 4] / 255;
        const r = cell * 0.64 * Math.sqrt(v);
        if (r < 0.3) continue;
        hx.push((i + 0.5 + (j % 2 ? 0.5 : 0)) * cell); hy.push((j + 0.5) * cell); rr.push(r);
      }
      this.n = hx.length; this.cell = cell;
      this.hx = Float32Array.from(hx); this.hy = Float32Array.from(hy); this.r = Float32Array.from(rr);
      this.x = new Float32Array(this.n); this.y = new Float32Array(this.n); this.vx = new Float32Array(this.n); this.vy = new Float32Array(this.n);
      const scatter = !this.ready && !reduce;
      for (let k = 0; k < this.n; k++) {
        if (scatter) { this.x[k] = this.hx[k] + (Math.random() - 0.5) * w * 0.12; this.y[k] = this.hy[k] + h * (0.25 + Math.random() * 0.5); }
        else { this.x[k] = this.hx[k]; this.y[k] = this.hy[k]; }
      }
      this.render();
      if (scatter) {
        const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); this.kick(); } }, { threshold: 0.3 });
        io.observe(this.c);
      }
      this.ready = true;
    }
    kick() { if (!this.loop && this.ready && !reduce) this.loop = requestAnimationFrame(() => this.step()); }
    step() {
      const { n, hx, hy, x, y, vx, vy } = this;
      const R = Math.max(40, this.w * 0.2);
      let en = 0;
      for (let k = 0; k < n; k++) {
        if (this.m) {
          const dx = x[k] - this.m.x; const dy = y[k] - this.m.y; const d2 = dx * dx + dy * dy;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1; const f = (1 - d / R) * 2.1; vx[k] += (dx / d) * f; vy[k] += (dy / d) * f; }
        }
        vx[k] = (vx[k] + (hx[k] - x[k]) * 0.055) * 0.83;
        vy[k] = (vy[k] + (hy[k] - y[k]) * 0.055) * 0.83;
        x[k] += vx[k]; y[k] += vy[k];
        en += Math.abs(vx[k]) + Math.abs(vy[k]);
      }
      this.render();
      this.loop = (en / n > 0.01 || this.m) ? requestAnimationFrame(() => this.step()) : 0;
    }
    render() {
      const { ctx, n, x, y, hx, hy, r } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      const red = [];
      ctx.fillStyle = '#ece6d8';
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        if (Math.abs(x[k] - hx[k]) + Math.abs(y[k] - hy[k]) > this.cell * 1.8) { red.push(k); continue; }
        ctx.moveTo(x[k] + r[k], y[k]); ctx.arc(x[k], y[k], r[k], 0, 6.2832);
      }
      ctx.fill();
      if (red.length) {
        ctx.fillStyle = '#dd3b2c'; ctx.beginPath();
        for (const k of red) { ctx.moveTo(x[k] + r[k], y[k]); ctx.arc(x[k], y[k], r[k], 0, 6.2832); }
        ctx.fill();
      }
    }
  }
  const faces = $$('.member canvas').map((c) => new Dots(c));

  /* ---------------- عکس‌ها: نوار فیلم کشیدنی ---------------- */
  const strip = $('.strip');
  if (strip) {
    let down = false, moved = false, sx = 0, sl = 0;
    strip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; strip.classList.add('drag'); }
      if (moved) strip.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { if (!down) return; down = false; setTimeout(() => strip.classList.remove('drag'), 0); });
    strip.addEventListener('click', (e) => {
      if (moved) { moved = false; return; }
      const b = e.target.closest('button[data-full]');
      if (b) openViewer(b, $$('button[data-full]', strip));
    });
  }

  /* ---------------- راه‌اندازی ---------------- */
  let lastW = innerWidth;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { buildRiver(); faces.forEach((f) => f.build()); });
  let rt;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - lastW) < 2) return;
    lastW = innerWidth; clearTimeout(rt);
    rt = setTimeout(() => { buildRiver(); faces.forEach((f) => f.build()); }, 160);
  });
})();
