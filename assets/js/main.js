/* ماخولا — سیاه‌مشق · بدون کتابخانه */
(() => {
  'use strict';
  window.MK = true;
  const doc = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ---------- فهرست + مهر کوچک ---------- */
  const seal = $('.mini-seal');
  const setIndex = (open) => {
    doc.classList.toggle('index-open', open);
    seal.setAttribute('aria-expanded', String(open));
    if (open) $('#fehrest a').focus({ preventScroll: true });
  };
  seal.addEventListener('click', () => setIndex(!doc.classList.contains('index-open')));
  $$('#fehrest a').forEach((a) => a.addEventListener('click', () => setIndex(false)));

  let lastScroll = scrollY;
  let flowBoost = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    doc.classList.toggle('past-open', y > innerHeight * 0.75);
    flowBoost = Math.min(7, flowBoost + Math.abs(y - lastScroll) * 0.03);
    lastScroll = y;
  }, { passive: true });

  /* ---------- نشان: پخش مرکب، سپس حروف ریز که از نوک قلم می‌گریزند ---------- */
  const emblem = $('.emblem');
  const ink = $('.emblem-ink');
  const glyphs = $$('.emblem .g').map((el) => ({ el, cx: +el.dataset.cx, cy: +el.dataset.cy, x: 0, y: 0, vx: 0, vy: 0 }));
  let glyphLoop = 0;
  let pointer = null;
  setTimeout(() => ink && ink.removeAttribute('mask'), reduce ? 0 : 3400);

  function glyphStep() {
    let energy = 0;
    for (const g of glyphs) {
      if (pointer) {
        const dx = g.cx + g.x - pointer.x;
        const dy = g.cy + g.y - pointer.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 170) {
          const f = (1 - dist / 170) ** 2 * 9;
          g.vx += (dx / dist) * f;
          g.vy += (dy / dist) * f;
        }
      }
      g.vx += -g.x * 0.045; g.vy += -g.y * 0.045;
      g.vx *= 0.84; g.vy *= 0.84;
      g.x += g.vx; g.y += g.vy;
      energy += Math.abs(g.vx) + Math.abs(g.vy) + Math.abs(g.x) * 0.02 + Math.abs(g.y) * 0.02;
      g.el.style.transform = `translate(${g.x.toFixed(2)}px, ${g.y.toFixed(2)}px) rotate(${(g.x * 0.6).toFixed(2)}deg)`;
    }
    glyphLoop = (energy > 0.05 || pointer) ? requestAnimationFrame(glyphStep) : 0;
  }
  if (emblem && !reduce) {
    const zone = $('.z-open');
    const toSvg = (e) => {
      const m = emblem.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };
    zone.addEventListener('pointermove', (e) => {
      if (performance.now() < 3400) return;
      pointer = toSvg(e);
      if (!glyphLoop) glyphLoop = requestAnimationFrame(glyphStep);
    });
    zone.addEventListener('pointerleave', () => { pointer = null; });
    zone.addEventListener('pointerup', () => { if (!finePointer) pointer = null; });
  }

  /* ---------- قلم: ردّ مرکب نیِ سرکج دنبال ماوس ---------- */
  const qalam = $('.qalam');
  if (qalam && finePointer && !reduce) {
    const ctx = qalam.getContext('2d');
    const pts = [];
    const NIB = -0.62; // زاویه‌ی قط قلم
    const LIFE = 760;
    let loop = 0;
    const size = () => { qalam.width = innerWidth * DPR; qalam.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
    size(); addEventListener('resize', size);
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || doc.classList.contains('viewer-open')) return;
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (!loop) loop = requestAnimationFrame(draw);
    }, { passive: true });
    function draw(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      const nx = Math.cos(NIB) * 4.6;
      const ny = Math.sin(NIB) * 4.6;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 140) continue;
        const life = 1 - (now - b.t) / LIFE;
        ctx.fillStyle = `rgba(18,17,16,${(life * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(a.x + nx, a.y + ny);
        ctx.lineTo(b.x + nx, b.y + ny); ctx.lineTo(b.x - nx, b.y - ny);
        ctx.closePath(); ctx.fill();
      }
      loop = pts.length ? requestAnimationFrame(draw) : 0;
    }
  }

  /* ---------- رود: شعر روی خط‌های موجی، روان ---------- */
  const lines = [];
  let uid = 0;
  function buildRivers() {
    lines.length = 0;
    $$('.river').forEach((river) => {
      const W = river.clientWidth;
      const H = river.clientHeight;
      if (!W || !H) return;
      river.querySelector('svg')?.remove();
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('aria-hidden', 'true');
      river.prepend(svg);
      const narrow = W < 820;
      $$('.rl', river).forEach((p) => {
        const y = (+p.dataset.y / 100) * H;
        const size = Math.max(15, (+p.dataset.size / 100) * W * (narrow ? 2.15 : 1));
        const amp = (+p.dataset.amp / 100) * W * (narrow ? 1.7 : 1);
        const wave = (+p.dataset.wave / 100) * W * (narrow ? 1.4 : 1);
        const ph = +p.dataset.phase || 0;
        let d = '';
        const step = Math.max(6, W / 180);
        for (let x = -0.06 * W; x <= 1.06 * W; x += step) {
          const yy = y + Math.sin((x / wave) * Math.PI * 2 + ph) * amp + Math.sin((x / (wave * 2.3)) * Math.PI * 2 + ph * 1.7) * amp * 0.4;
          d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`;
        }
        const id = `rl${uid++}`;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('id', id); path.setAttribute('d', d); path.setAttribute('fill', 'none');
        svg.appendChild(path);
        const words = `${p.textContent.trim()} `;
        const probe = document.createElementNS(NS, 'text');
        probe.setAttribute('font-size', size.toFixed(1));
        probe.textContent = words;
        svg.appendChild(probe);
        const seg = probe.getComputedTextLength() || size * words.length * 0.4;
        probe.remove();
        const len = path.getTotalLength();
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('font-size', size.toFixed(1));
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('class', p.className);
        const tp = document.createElementNS(NS, 'textPath');
        tp.setAttribute('href', `#${id}`);
        tp.textContent = words.repeat(Math.ceil((len + seg) / seg) + 1);
        text.appendChild(tp);
        svg.appendChild(text);
        const L = { river, tp, len, seg, off: (ph / 6.28) * seg, speed: +p.dataset.speed || 6 };
        tp.setAttribute('startOffset', (len + L.off).toFixed(1));
        lines.push(L);
      });
    });
  }
  const riverVisible = new Set();
  const riverIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) riverVisible.add(en.target); else riverVisible.delete(en.target);
  }), { rootMargin: '100px 0px' });
  $$('.river').forEach((r) => riverIO.observe(r));
  let lastT = performance.now();
  let frame = 0;
  function flow(now) {
    const dt = Math.min(0.06, (now - lastT) / 1000);
    lastT = now;
    flowBoost *= Math.pow(0.08, dt);
    if (++frame % 2 === 0) {
      for (const L of lines) {
        if (!riverVisible.has(L.river)) continue;
        L.off += L.speed * 3.2 * (1 + flowBoost) * dt * 2;
        L.off = ((L.off % L.seg) + L.seg) % L.seg;
        L.tp.setAttribute('startOffset', (L.len + L.off).toFixed(1));
      }
    }
    requestAnimationFrame(flow);
  }

  /* ---------- دیوار: پوسترهای چسبیده، جابه‌جاشدنی ---------- */
  const wall = $('.wall');
  let zTop = 10;
  function layoutWall() {
    if (!wall) return;
    const W = wall.clientWidth;
    const narrow = W < 700;
    const rand = rng(1392);
    const gap = narrow ? 12 : W * 0.016;
    const baseH = narrow ? W * 0.6 : W * 0.21;
    let x = W;
    let y = 0;
    let rowH = 0;
    const newRow = () => { x = W; y += rowH * 0.84 + gap; rowH = 0; };
    $$(':scope > *', wall).forEach((el) => {
      if (el.classList.contains('wall-year')) {
        const lw = el.offsetWidth;
        if (x - lw < 0) newRow();
        const tx = x - lw;
        const ty = y + baseH * (0.08 + rand() * 0.2);
        el.style.transform = `translate(${tx.toFixed(0)}px, ${ty.toFixed(0)}px) rotate(${(-9 + rand() * 6).toFixed(1)}deg)`;
        x -= lw + gap * 0.3;
        rowH = Math.max(rowH, el.offsetHeight);
        return;
      }
      const ar = parseFloat(el.dataset.ar) || 0.75;
      let h = baseH * (0.84 + rand() * 0.3);
      let w = h * ar;
      const maxW = narrow ? W * 0.48 : W * 0.25;
      if (w > maxW) { w = maxW; h = w / ar; }
      if (x - w < -W * 0.03) newRow();
      const px = x - w + (rand() - 0.5) * gap * 1.8;
      const py = y + (rand() - 0.5) * baseH * 0.14;
      const rot = (rand() - 0.5) * 9;
      el.style.width = `${w.toFixed(0)}px`;
      el.style.setProperty('--tr', `${((rand() - 0.5) * 12).toFixed(1)}deg`);
      el.dataset.x = px; el.dataset.y = py; el.dataset.r = rot;
      el.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) rotate(${rot.toFixed(1)}deg)`;
      x -= w + gap;
      rowH = Math.max(rowH, h + 14);
    });
    wall.style.height = `${(y + rowH + 60).toFixed(0)}px`;
  }
  if (wall) {
    wall.addEventListener('pointerdown', (e) => {
      const poster = e.target.closest('.poster');
      if (!poster || e.pointerType === 'touch' || e.button !== 0) return;
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = +poster.dataset.x;
      const oy = +poster.dataset.y;
      const r = +poster.dataset.r;
      let moved = false;
      poster.style.zIndex = ++zTop;
      const move = (ev) => {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 5) { moved = true; poster.classList.add('is-dragging'); poster.setPointerCapture(ev.pointerId); }
        if (!moved) return;
        poster.dataset.x = ox + dx; poster.dataset.y = oy + dy;
        poster.style.transform = `translate(${ox + dx}px, ${oy + dy}px) rotate(${r * 0.4}deg) scale(1.04)`;
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        poster.classList.remove('is-dragging');
        if (moved) {
          poster.dataset.r = r * 0.6 + (Math.random() - 0.5) * 6;
          poster.style.transform = `translate(${poster.dataset.x}px, ${poster.dataset.y}px) rotate(${(+poster.dataset.r).toFixed(1)}deg)`;
          poster.dragged = true;
        }
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }

  /* ---------- چهره‌ها: چاپ هافتون که با نوک قلم پخش می‌شود ---------- */
  class Face {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.mouse = null;
      this.loop = 0;
      this.ready = false;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { this.img = img; this.build(); };
      img.src = canvas.dataset.map;
      canvas.addEventListener('pointermove', (e) => this.point(e));
      canvas.addEventListener('pointerdown', (e) => this.point(e));
      canvas.addEventListener('pointerleave', () => { this.mouse = null; this.kick(); });
      canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { this.mouse = null; this.kick(); } });
    }
    build() {
      const cw = this.c.clientWidth;
      const ch = this.c.clientHeight;
      if (!cw || !this.img) return;
      this.w = cw; this.h = ch;
      this.c.width = Math.round(cw * DPR); this.c.height = Math.round(ch * DPR);
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cols = Math.round(Math.min(78, Math.max(42, cw / 4.6)));
      const cell = cw / cols;
      const rows = Math.round(ch / cell);
      const off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      const octx = off.getContext('2d', { willReadFrequently: true });
      octx.drawImage(this.img, 0, 0, cols, rows);
      const data = octx.getImageData(0, 0, cols, rows).data;
      const hx = []; const hy = []; const rr = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const v = 1 - data[(j * cols + i) * 4] / 255;
          const r = cell * 0.6 * Math.sqrt(v);
          if (r < 0.35) continue;
          hx.push((i + 0.5 + (j % 2 ? 0.5 : 0)) * cell); hy.push((j + 0.5) * cell); rr.push(r);
        }
      }
      const n = hx.length;
      this.n = n; this.cell = cell;
      this.hx = Float32Array.from(hx); this.hy = Float32Array.from(hy); this.r = Float32Array.from(rr);
      this.x = new Float32Array(n); this.y = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n);
      const scatter = !this.ready && !reduce;
      for (let k = 0; k < n; k++) {
        if (scatter) {
          const a = Math.random() * 6.283;
          const d = 40 + Math.random() * cw * 0.6;
          this.x[k] = this.hx[k] + Math.cos(a) * d; this.y[k] = this.hy[k] + Math.sin(a) * d;
        } else { this.x[k] = this.hx[k]; this.y[k] = this.hy[k]; }
      }
      this.ready = true;
      this.render();
      if (scatter) this.waitForView();
    }
    waitForView() {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); this.kick(); } }, { threshold: 0.25 });
      io.observe(this.c);
    }
    point(e) {
      const b = this.c.getBoundingClientRect();
      this.mouse = { x: e.clientX - b.left, y: e.clientY - b.top };
      this.kick();
    }
    kick() { if (!this.loop && this.ready && !reduce) this.loop = requestAnimationFrame(() => this.step()); }
    step() {
      const { n, hx, hy, x, y, vx, vy } = this;
      const R = Math.max(46, this.w * 0.2);
      let energy = 0;
      for (let k = 0; k < n; k++) {
        if (this.mouse) {
          const dx = x[k] - this.mouse.x;
          const dy = y[k] - this.mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / R) * 2.2;
            vx[k] += (dx / d) * f; vy[k] += (dy / d) * f;
          }
        }
        vx[k] = (vx[k] + (hx[k] - x[k]) * 0.06) * 0.82;
        vy[k] = (vy[k] + (hy[k] - y[k]) * 0.06) * 0.82;
        x[k] += vx[k]; y[k] += vy[k];
        energy += Math.abs(vx[k]) + Math.abs(vy[k]);
      }
      this.render();
      this.loop = (energy / n > 0.01 || this.mouse) ? requestAnimationFrame(() => this.step()) : 0;
    }
    render() {
      const { ctx, n, x, y, hx, hy, r } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#121110';
      ctx.beginPath();
      const red = [];
      for (let k = 0; k < n; k++) {
        const disp = Math.abs(x[k] - hx[k]) + Math.abs(y[k] - hy[k]);
        if (disp > this.cell * 1.6) { red.push(k); continue; }
        ctx.moveTo(x[k] + r[k], y[k]);
        ctx.arc(x[k], y[k], r[k], 0, 6.2832);
      }
      ctx.fill();
      if (red.length) {
        ctx.fillStyle = '#cf3a24';
        ctx.beginPath();
        for (const k of red) { ctx.moveTo(x[k] + r[k], y[k]); ctx.arc(x[k], y[k], r[k], 0, 6.2832); }
        ctx.fill();
      }
    }
  }
  const faces = $$('.face canvas').map((c) => new Face(c));

  /* ---------- نمایشگر ---------- */
  const viewer = $('.viewer');
  const vMedia = $('.viewer__media');
  const vCap = $('.viewer__cap');
  let group = [];
  let gi = 0;
  let opener = null;
  const NEMI = {
    img: 'assets/img/covers/nemikaham.webp', title: 'نمی‌کاهم',
    meta: 'آلبوم تازه‌ی ماخولا، کمتر از یک ماه دیگر · گَرَم یادآوری یا نه، من از یادت نمی‌کاهم — نیما یوشیج',
    links: [['خبرها در تلگرام', 'https://t.me/makhoola']],
  };
  const dataOf = (el) => (el.dataset.view === 'nemikaham' ? NEMI : JSON.parse(el.dataset.view));
  function show(i) {
    gi = (i + group.length) % group.length;
    const d = dataOf(group[gi]);
    vMedia.replaceChildren();
    if (d.yt) {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${d.yt}?autoplay=1&rel=0`;
      f.title = d.title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      vMedia.append(f);
    } else {
      const im = document.createElement('img');
      im.src = d.img; im.alt = d.title;
      vMedia.append(im);
    }
    const b = document.createElement('b'); b.textContent = d.title;
    const m = document.createElement('div'); m.textContent = d.meta || '';
    vCap.replaceChildren(b, m);
    if (d.links && d.links.length) {
      const lk = document.createElement('div'); lk.className = 'lk';
      d.links.forEach(([t, u], k) => {
        if (k) lk.append(' · ');
        const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; lk.append(a);
      });
      vCap.append(lk);
    }
  }
  function openViewer(trigger) {
    const kind = trigger.closest('.poster') ? '.poster [data-view]' : trigger.closest('.painting') ? '.painting [data-view]' : null;
    group = kind ? $$(kind) : [trigger];
    opener = trigger;
    viewer.classList.toggle('is-single', group.length < 2);
    show(group.indexOf(trigger));
    viewer.hidden = false;
    doc.classList.add('viewer-open');
    $('.viewer__close').focus();
  }
  function closeViewer() {
    viewer.hidden = true;
    vMedia.replaceChildren();
    doc.classList.remove('viewer-open');
    if (opener) opener.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-view]');
    if (!t) return;
    const poster = t.closest('.poster');
    if (poster && poster.dragged) { poster.dragged = false; return; }
    openViewer(t);
  });
  $('.viewer__close').addEventListener('click', closeViewer);
  $('.viewer__prev').addEventListener('click', () => show(gi - 1));
  $('.viewer__next').addEventListener('click', () => show(gi + 1));
  viewer.addEventListener('click', (e) => { if (e.target === viewer) closeViewer(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!viewer.hidden) closeViewer();
      else if (doc.classList.contains('index-open')) { setIndex(false); seal.focus(); }
    }
    if (!viewer.hidden && group.length > 1) {
      if (e.key === 'ArrowLeft') show(gi + 1);
      if (e.key === 'ArrowRight') show(gi - 1);
    }
  });

  /* ---------- راه‌اندازی و بازچینی ---------- */
  let lastW = innerWidth;
  const relayout = () => { buildRivers(); layoutWall(); faces.forEach((f) => f.build()); };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    relayout();
    if (!reduce) requestAnimationFrame(flow);
  });
  let rt;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - lastW) < 2) return;
    lastW = innerWidth;
    clearTimeout(rt);
    rt = setTimeout(relayout, 160);
  });
})();
