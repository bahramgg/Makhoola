/* ماخولا · دیوار — wall interactions: pan, fly, map, viewer, rain, light */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FA = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

  const wall = $('#wall'), cam = $('#cam'), world = $('#world');
  const V = JSON.parse($('#data').textContent);
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const districts = $$('.d', world);
  const navLinks = $$('.nav a');

  /* ------------------------------------------------------------ geometry */
  const vw = () => wall.clientWidth, vh = () => wall.clientHeight;
  const maxX = () => wall.scrollWidth - wall.clientWidth, maxY = () => wall.scrollHeight - wall.clientHeight;
  function contentRect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + wall.scrollLeft, y: r.top + wall.scrollTop, w: r.width, h: r.height };
  }
  let boxes = {};
  function measure() {
    boxes = {};
    for (const d of districts) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of d.children) {
        if (c.classList.contains('pipe')) continue;
        const r = c.getBoundingClientRect();
        if (!r.width) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      boxes[d.id] = { x: x0 + wall.scrollLeft, y: y0 + wall.scrollTop, w: x1 - x0, h: y1 - y0 };
    }
    pending = $$('img[loading="lazy"]', world).map((img) => ({ img, r: contentRect(img) }));
    const p = $('.proj');
    projBox = p ? contentRect(p) : null;
    const n = $('.neon');
    neonBox = n ? contentRect(n) : null;
  }
  let pending = [], projBox = null, neonBox = null;

  /* ------------------------------------------------------------ camera moves */
  let fly = 0, inertiaRaf = 0;
  function stopMotion() { cancelAnimationFrame(fly); cancelAnimationFrame(inertiaRaf); fly = inertiaRaf = 0; }
  function scrollToXY(x, y, dur = 950) {
    stopMotion();
    const tx = clamp(x, 0, maxX()), ty = clamp(y, 0, maxY());
    const sx = wall.scrollLeft, sy = wall.scrollTop;
    if (reduce() || !dur) { wall.scrollTo(tx, ty); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / dur, 0, 1);
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      wall.scrollTo(sx + (tx - sx) * e, sy + (ty - sy) * e);
      fly = k < 1 ? requestAnimationFrame(step) : 0;
    };
    fly = requestAnimationFrame(step);
  }
  const ANCHOR = { shows: [.16, .3], music: [.55, .42], band: [.5, .4], photos: [.5, .42], contact: [.5, .36], video: [.5, .45], new: [.5, .38] };
  const ANCHOR_M = { shows: [.5, .25], music: [.5, .3], band: [.5, .3], new: [.5, .3] };
  function goTo(key, dur) {
    const b = boxes[key];
    if (!b) return;
    const [ax, ay] = (vw() < 761 && ANCHOR_M[key]) || ANCHOR[key] || [.5, .5];
    let cx = b.x + b.w * ax, cy = b.y + b.h * ay;
    if (b.w < vw() * .9) cx = b.x + b.w / 2;
    if (b.h < vh() * .8) cy = b.y + b.h / 2;
    const y = clamp(cy - vh() / 2, b.y - 120, Math.max(b.y - 120, b.y + b.h - vh() + 60));
    scrollToXY(cx - vw() / 2, y, dur);
    setHere(key);
    hideHint();
  }

  /* ------------------------------------------------------------ mouse drag + inertia (touch uses native scrolling) */
  let drag = null, suppressClick = false;
  wall.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch' || ev.button !== 0 || mapOn) return;
    if (ev.target.closest('.notice a, .notice button, .press a, .nextspot a, .ft__b a')) return;
    stopMotion();
    drag = { x: ev.clientX, y: ev.clientY, sl: wall.scrollLeft, st: wall.scrollTop, id: ev.pointerId, moved: false, hist: [] };
  });
  addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      wall.classList.add('is-drag');
      hideHint();
    }
    if (drag.moved) {
      wall.scrollLeft = drag.sl - dx;
      wall.scrollTop = drag.st - dy;
      drag.hist.push([performance.now(), ev.clientX, ev.clientY]);
      if (drag.hist.length > 8) drag.hist.shift();
    }
  });
  function endDrag(ev) {
    if (!drag || (ev && ev.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    wall.classList.remove('is-drag');
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 80);
    const now = performance.now();
    const h = d.hist.filter((p) => now - p[0] < 90);
    if (h.length < 2 || reduce()) return;
    const a = h[0], b = h[h.length - 1], dt = Math.max(8, b[0] - a[0]);
    let vx = (b[1] - a[1]) / dt, vy = (b[2] - a[2]) / dt;
    let last = now;
    const step = (t) => {
      const dt2 = Math.min(34, t - last); last = t;
      wall.scrollLeft -= vx * dt2; wall.scrollTop -= vy * dt2;
      const f = Math.pow(.935, dt2 / 16); vx *= f; vy *= f;
      inertiaRaf = Math.abs(vx) + Math.abs(vy) > .02 ? requestAnimationFrame(step) : 0;
    };
    inertiaRaf = requestAnimationFrame(step);
  }
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  wall.addEventListener('click', (ev) => { if (suppressClick) { ev.preventDefault(); ev.stopPropagation(); suppressClick = false; } }, true);
  wall.addEventListener('wheel', () => { stopMotion(); hideHint(); }, { passive: true });
  wall.addEventListener('dragstart', (ev) => ev.preventDefault());

  /* ------------------------------------------------------------ keyboard */
  document.addEventListener('keydown', (ev) => {
    if (viewerOpen) return onViewerKey(ev);
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.target.closest && ev.target.closest('input, textarea, select')) return;
    const k = ev.key, big = ev.shiftKey ? 520 : 170;
    const mv = { ArrowLeft: [-big, 0], ArrowRight: [big, 0], ArrowUp: [0, -big], ArrowDown: [0, big] }[k];
    if (mv && !mapOn) {
      ev.preventDefault();
      stopMotion();
      wall.scrollBy({ left: mv[0], top: mv[1], behavior: reduce() ? 'auto' : 'smooth' });
      hideHint();
    } else if (k === 'm' || k === 'M' || k === 'پ') {
      toggleMap();
    } else if (k === 'Escape' && mapOn) {
      exitMap();
    } else if (k === 'Home' && !mapOn) {
      ev.preventDefault();
      goTo('new');
    }
  });
  // keep keyboard focus comfortably on screen
  world.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (mapOn || !el.matches(':focus-visible')) return;
    const r = el.getBoundingClientRect();
    const m = 90;
    if (r.left < m || r.top < m || r.right > vw() - m || r.bottom > vh() - m) {
      scrollToXY(wall.scrollLeft + r.left + r.width / 2 - vw() / 2, wall.scrollTop + r.top + r.height / 2 - vh() / 2, 420);
    }
  });

  /* ------------------------------------------------------------ nav + "you are here" */
  function setHere(key) {
    for (const a of navLinks) a.classList.toggle('is-here', a.dataset.go === key);
  }
  $$('[data-go]').forEach((el) => el.addEventListener('click', (ev) => {
    ev.preventDefault();
    const key = el.dataset.go;
    const go = () => { goTo(key); history.replaceState(null, '', key === 'new' ? location.pathname : '#' + key); };
    if (mapOn) exitMap(null, null, go); else go();
  }));
  function nearest() {
    const cx = wall.scrollLeft + vw() / 2, cy = wall.scrollTop + vh() / 2;
    let best = null, bd = Infinity;
    for (const [k, b] of Object.entries(boxes)) {
      const dx = Math.max(b.x - cx, 0, cx - (b.x + b.w)), dy = Math.max(b.y - cy, 0, cy - (b.y + b.h));
      const d = Math.hypot(dx, dy) - (dx === 0 && dy === 0 ? 1e5 / (b.w * b.h) : 0);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /* ------------------------------------------------------------ scroll housekeeping: lazy images, projector, here */
  let ticking = false, moves = 0;
  wall.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  function onScroll() {
    ticking = false;
    if (mapOn) return;
    wake();
    projCheck();
    if (!fly) setHere(nearest());
    if (++moves > 12) hideHint();
  }
  function wake(all) {
    const m = .9;
    const x0 = wall.scrollLeft - vw() * m, x1 = wall.scrollLeft + vw() * (1 + m);
    const y0 = wall.scrollTop - vh() * m, y1 = wall.scrollTop + vh() * (1 + m);
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (all || (p.r.x < x1 && p.r.x + p.r.w > x0 && p.r.y < y1 && p.r.y + p.r.h > y0)) {
        p.img.loading = 'eager';
        pending.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------------ neon + projector */
  const proj = $('.proj'), pv = $('.proj__v');
  let projOn = false, projWanted = false;
  function projCheck() {
    if (!pv || !projWanted || !projBox) return;
    const vis = projBox.x < wall.scrollLeft + vw() + 200 && projBox.x + projBox.w > wall.scrollLeft - 200 &&
                projBox.y < wall.scrollTop + vh() + 200 && projBox.y + projBox.h > wall.scrollTop - 200;
    if (reduce()) { proj.classList.add('is-on', 'is-still'); return; }
    if (vis && !projOn && !document.hidden && !viewerOpen) {
      projOn = true;
      pv.preload = 'auto';
      const p = pv.play();
      if (p && p.catch) p.catch(() => { projOn = false; });
      proj.classList.add('is-on');
    } else if ((!vis || document.hidden || viewerOpen) && projOn) {
      projOn = false;
      pv.pause();
    }
  }
  function lightUp() {
    const n = $('.neon');
    if (n) n.classList.add('is-on');
    setTimeout(() => { projWanted = true; projCheck(); }, reduce() ? 0 : 1500);
    setTimeout(showHint, reduce() ? 300 : 2300);
  }

  /* ------------------------------------------------------------ hint + toast */
  const hint = $('.hint');
  let hintTimer = 0, hinted = false;
  function showHint() {
    if (hinted) return;
    hinted = true;
    hint.classList.add('is-on');
    hintTimer = setTimeout(hideHint, 7000);
  }
  function hideHint() { hinted = true; clearTimeout(hintTimer); hint.classList.remove('is-on'); }
  const toastEl = $('.toast');
  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  /* ------------------------------------------------------------ map (overview) */
  let mapOn = false, mapState = null, saved = null;
  const mapBtn = $('[data-map]'), labels = $('.maplabels');
  function toggleMap() { if (mapOn) exitMap(); else enterMap(); }
  function enterMap() {
    if (mapOn || viewerOpen) return;
    stopMotion();
    measure();
    mapOn = true;
    const W = cam.offsetWidth, H = cam.offsetHeight;
    const top = 70, bottom = 70;
    const s = Math.min(vw() / W, (vh() - top - bottom) / H) * .95;
    const sl = wall.scrollLeft, st = wall.scrollTop;
    saved = { cx: sl + vw() / 2, cy: st + vh() / 2 };
    cam.style.transition = 'none';
    cam.style.transform = `translate(${-sl}px,${-st}px)`;
    wall.classList.add('is-map');
    wall.scrollTo(0, 0);
    void cam.offsetWidth;
    const tx = (vw() - W * s) / 2, ty = top + (vh() - top - bottom - H * s) / 2;
    mapState = { s, tx, ty };
    cam.style.transition = reduce() ? 'none' : 'transform .95s cubic-bezier(.65, 0, .25, 1)';
    cam.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    labels.innerHTML = '';
    for (const d of districts) {
      const b = boxes[d.id];
      if (!b) continue;
      const li = document.createElement('li');
      li.textContent = d.dataset.label;
      li.style.left = `${tx + (b.x + b.w / 2) * s}px`;
      li.style.top = `${ty + (b.y + b.h / 2) * s}px`;
      li.style.transform = `translate(50%,-50%) rotate(${(Math.random() * 6 - 3).toFixed(1)}deg)`;
      labels.appendChild(li);
    }
    document.body.classList.add('map-on');
    mapBtn.setAttribute('aria-pressed', 'true');
    wake(true);
    hideHint();
    if (projOn) { projOn = false; pv.pause(); }
  }
  function exitMap(px, py, after) {
    if (!mapOn) { if (after) after(); return; }
    const c = px != null ? { cx: px, cy: py } : saved;
    const W = cam.offsetWidth, H = cam.offsetHeight;
    const sl = clamp(c.cx - vw() / 2, 0, Math.max(0, W - vw())), st = clamp(c.cy - vh() / 2, 0, Math.max(0, H - vh()));
    document.body.classList.remove('map-on');
    mapBtn.setAttribute('aria-pressed', 'false');
    const done = () => {
      if (!mapOn) return;
      mapOn = false;
      cam.style.transition = 'none';
      cam.style.transform = '';
      wall.classList.remove('is-map');
      wall.scrollTo(sl, st);
      setHere(nearest());
      projCheck();
      if (after) after();
    };
    if (reduce()) return done();
    cam.style.transition = 'transform .85s cubic-bezier(.65, 0, .25, 1)';
    cam.style.transform = `translate(${-sl}px,${-st}px) scale(1)`;
    cam.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 1000);
  }
  mapBtn.addEventListener('click', toggleMap);
  wall.addEventListener('click', (ev) => {
    if (!mapOn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const { s, tx, ty } = mapState;
    exitMap((ev.clientX - tx) / s, (ev.clientY - ty) / s);
  }, true);

  /* ------------------------------------------------------------ viewer */
  const vEl = $('#viewer'), stage = $('.viewer__stage', vEl), body = $('.viewer__body', vEl), vtitle = $('#vt');
  const prevB = $('.viewer__prev', vEl), nextB = $('.viewer__next', vEl), counter = $('.viewer__n', vEl);
  let viewerOpen = false, cur = null, opener = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ext = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
  function render(type, i) {
    const d = (V[type] || [])[i];
    let media = '', info = '', label = '';
    if (type === 'poster') {
      label = `اجرای ${d.d}`;
      media = d.img ? `<img class="v-media" src="${esc(d.img)}" alt="پوستر اجرای ${esc(d.d)}، ${esc(d.city)}">`
        : `<div class="v-media paper paper--pink flyer v-paper"><div class="paper__sheet"><p class="flyer__k">اجرای زنده</p><p class="flyer__t">ماخولا در دینامیک</p><p>${esc(d.d)}</p><p>${esc(d.venue)}</p></div></div>`;
      info = `<p class="vi-k">اجرا · ${FA(d.y)}</p><p class="vi-t">${esc(d.d)}</p><p><b>${esc(d.city)}</b>${d.venue ? '، ' + esc(d.venue) : ''}</p>` +
        (d.note ? `<p>${esc(d.note)}</p>` : '') + (d.st ? `<p class="vi-st">${esc(d.st)}</p>` : '') +
        (d.img ? `<ul class="vi-links"><li><a href="${esc(d.img)}" target="_blank" rel="noopener">پوستر در اندازه‌ی کامل</a></li></ul>` : '');
    } else if (type === 'release') {
      label = d.t;
      media = `<img class="v-media" src="${esc(d.img)}" alt="جلد «${esc(d.t)}»">`;
      info = `<p class="vi-k">${esc(d.k)} · ${esc(d.d)}</p><p class="vi-t">${esc(d.t)} <span class="vi-la" lang="en">${esc(d.la)}</span></p>` +
        (d.poet ? `<p>شعر: <b>${esc(d.poet)}</b></p>` : '') +
        (d.verse ? `<p class="vi-verse">${d.verse}</p>` : '') +
        (d.note ? `<p>${esc(d.note)}</p>` : '') +
        (d.tracks ? `<ol class="vi-tr">${d.tracks.map((t) => `<li><b>${esc(t[0])}</b>، ${esc(t[1])} <span>(${FA(t[2])})</span></li>`).join('')}</ol>` : '') +
        (d.extra ? `<p>${esc(d.extra)}</p>` : '') +
        (d.cr && d.cr.length ? `<dl class="vi-cr">${d.cr.map((c) => `<dt>${esc(c[0])}</dt><dd>${esc(c[1])}</dd>`).join('')}</dl>` : '') +
        `<ul class="vi-links">${d.links.map((l) => `<li>${ext(l[1], l[0])}</li>`).join('')}</ul>`;
    } else if (type === 'photo') {
      label = d.alt;
      media = `<img class="v-media" src="${esc(d.img)}" alt="${esc(d.alt)}">`;
      info = `<p class="vi-k">عکس</p><p class="vi-t">${esc(d.c)}</p>` + (d.ph ? `<p>عکس: <b>${esc(d.ph)}</b></p>` : '') + `<p>${esc(d.alt)}</p>`;
    } else if (type === 'member') {
      label = d.n;
      media = `<img class="v-media" src="${esc(d.img)}" alt="کپی سیاه‌وسفید از عکس ${esc(d.n)}">`;
      info = `<p class="vi-k">گروه</p><p class="vi-t">${esc(d.n)}</p><p><b>${esc(d.r)}</b></p><p>${esc(d.t)}</p>`;
    } else if (type === 'video') {
      label = d.t;
      media = `<iframe class="v-video" src="https://www.youtube-nocookie.com/embed/${esc(d.id)}?autoplay=1&rel=0" title="${esc(d.t)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      info = `<p class="vi-k">ویدیو</p><p class="vi-t">${esc(d.t)}</p><p>${esc(d.c)}</p><ul class="vi-links"><li>${ext('https://www.youtube.com/watch?v=' + d.id, 'تماشا در یوتیوب')}</li></ul>`;
    } else if (type === 'teaser') {
      label = d.t;
      media = `<video class="v-video" controls autoplay playsinline poster="assets/video/nemikaham-teaser.webp"><source src="assets/video/nemikaham-teaser.webm" type="video/webm"><source src="assets/video/nemikaham-teaser.mp4" type="video/mp4"></video>`;
      info = `<p class="vi-k">آلبوم دوم · به‌زودی</p><p class="vi-t">نمی‌کاهم</p><p>${esc(d.c)}</p><p>کمتر از یک ماه تا انتشار. جزئیات پیش‌فروش و تاریخ انتشار به‌زودی اعلام می‌شود. <span style="color:#6c675c">(کانال تلگرام ماخولا، ۱۵ مهر ۱۴۰۵)</span></p><ul class="vi-links"><li>${ext('https://t.me/makhoola', 'کانال تلگرام')}</li><li>${ext('https://t.me/makhoola/239', '«آیا صبح»، اجرای زنده')}</li><li>${ext('https://open.spotify.com/track/0T0BBTbwytFV4Fvty2kS2f', '«می‌کشانی‌ام»')}</li></ul>`;
    } else if (type === 'paper') {
      label = 'متن';
      const clone = paperSrc[i].cloneNode(true);
      clone.removeAttribute('style');
      clone.classList.remove('it');
      clone.classList.add('v-paper', 'v-media');
      stage.innerHTML = '';
      stage.appendChild(clone);
      body.innerHTML = '';
      vEl.classList.add('is-paper');
      return label;
    }
    vEl.classList.remove('is-paper');
    stage.innerHTML = media;
    body.innerHTML = info;
    return label;
  }
  const paperSrc = $$('.paper', world).filter((p) => !p.matches('button'));
  paperSrc.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mag';
    b.setAttribute('aria-label', 'بزرگ‌نمایی این برگه');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>';
    b.addEventListener('click', (ev) => { ev.stopPropagation(); openV('paper', i, p); });
    p.appendChild(b);
    p.addEventListener('click', (ev) => {
      if (ev.target.closest('a, button')) return;
      openV('paper', i, p);
    });
  });
  function openV(type, i, from) {
    if (mapOn) return;
    const was = viewerOpen;
    if (!was) opener = from || document.activeElement;
    viewerOpen = true;
    cur = { type, i };
    const label = render(type, i);
    vtitle.textContent = label || 'جزئیات';
    const list = V[type] || [];
    const multi = type !== 'paper' && type !== 'teaser' && list.length > 1;
    vEl.querySelector('.viewer__nav').style.display = multi ? '' : 'none';
    if (multi) {
      prevB.disabled = i <= 0;
      nextB.disabled = i >= list.length - 1;
      counter.textContent = `${FA(i + 1)} از ${FA(list.length)}`;
    }
    vEl.hidden = false;
    document.body.classList.add('v-on');
    if (projOn) { projOn = false; pv.pause(); }
    if (sound.on) sound.duck(type === 'video' || type === 'teaser');
    if (!was) {
      const x = $('.viewer__x', vEl);
      x.focus({ preventScroll: true });
      flip(from);
    }
  }
  function flip(from) {
    if (!from || reduce() || !stage.firstElementChild || !stage.firstElementChild.animate) return;
    const a = from.getBoundingClientRect();
    const target = stage.firstElementChild;
    const go = () => {
      const b = target.getBoundingClientRect();
      if (!b.width || !a.width) return;
      const s = a.width / b.width;
      target.animate([
        { transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${s})`, opacity: .4 },
        { transform: 'none', opacity: 1 },
      ], { duration: 480, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    };
    if (target.tagName === 'IMG' && !target.complete) target.addEventListener('load', go, { once: true }); else go();
    vEl.querySelector('.viewer__info').animate([{ opacity: 0, transform: 'translateY(16px) rotate(.8deg)' }, { opacity: 1, transform: 'rotate(.8deg)' }], { duration: 420, delay: 120, fill: 'backwards', easing: 'ease-out' });
  }
  function closeV() {
    if (!viewerOpen) return;
    viewerOpen = false;
    stage.innerHTML = '';
    body.innerHTML = '';
    vEl.hidden = true;
    document.body.classList.remove('v-on');
    if (sound.on) sound.duck(false);
    projCheck();
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  function step(d) {
    if (!cur) return;
    const n = (V[cur.type] || []).length;
    const j = cur.i + d;
    if (j < 0 || j >= n) return;
    openV(cur.type, j, null);
    const t = stage.firstElementChild;
    if (t && t.animate && !reduce()) t.animate([{ opacity: 0, transform: `translateX(${d * -24}px)` }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
  }
  prevB.addEventListener('click', () => step(-1));
  nextB.addEventListener('click', () => step(1));
  $$('[data-close]', vEl).forEach((b) => b.addEventListener('click', closeV));
  function onViewerKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); closeV(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); step(-1); }
    else if (ev.key === 'Tab') {
      const f = $$('button, a[href], iframe, video[controls]', vEl).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-v]');
    if (!t || mapOn) return;
    ev.preventDefault();
    openV(t.dataset.v, +t.dataset.i, t.closest('.it') || t);
  });

  /* ------------------------------------------------------------ tear-off tabs */
  $$('.tab').forEach((t) => t.addEventListener('click', (ev) => {
    if (!coarse) {
      ev.preventDefault();
      const num = '09040646797';
      const ok = () => toast('شماره کپی شد: ۰۹۰۴ ۰۶۴ ۶۷۹۷');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(ok, () => toast('۰۹۰۴ ۰۶۴ ۶۷۹۷'));
      else toast('۰۹۰۴ ۰۶۴ ۶۷۹۷');
    }
    if (reduce()) return;
    t.classList.add('tab--tearing');
    setTimeout(() => {
      t.classList.add('tab--gone');
      t.classList.remove('tab--tearing');
      const left = $$('.tab:not(.tab--gone)');
      if (!left.length) $$('.tab').forEach((x) => x.classList.remove('tab--gone'));
    }, 720);
  }));

  /* ------------------------------------------------------------ pointer light */
  const glow = $('.glow');
  if (fine && glow) {
    let gx = 0, gy = 0, gr = 0;
    addEventListener('pointermove', (ev) => {
      gx = ev.clientX; gy = ev.clientY;
      if (!gr) gr = requestAnimationFrame(() => { glow.style.transform = `translate3d(${gx}px,${gy}px,0)`; gr = 0; });
      document.body.classList.add('has-glow');
    }, { passive: true });
    document.addEventListener('pointerleave', () => document.body.classList.remove('has-glow'));
  }

  /* ------------------------------------------------------------ rain (in front of the wall) */
  const cv = $('#rain'), ctx = cv.getContext('2d');
  let drops = [], CW = 0, CH = 0, last = 0, rainRaf = 0;
  const WIND = .17;
  function newDrop(anyY) {
    return { x: Math.random() * (CW + 240) - 120, y: anyY ? Math.random() * CH : -30 - Math.random() * 120,
      l: 9 + Math.random() * 24, v: .85 + Math.random() * .75, a: Math.random() };
  }
  let rq = 1, probe = [];   // rain quality: 1 full, .5 half-resolution & half the drops, 0 off
  function sizeRain() {
    CW = Math.round(innerWidth); CH = Math.round(innerHeight);
    cv.width = Math.round(CW * (rq || 1)); cv.height = Math.round(CH * (rq || 1));
    ctx.setTransform(rq || 1, 0, 0, rq || 1, 0, 0);
    const n = Math.round(clamp(CW * CH / (coarse ? 9000 : 6500), 40, 260) * (rq < 1 ? .55 : 1));
    drops = Array.from({ length: n }, () => newDrop(true));
  }
  function inRect(x, y, r, pad) { return r && x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad; }
  function rainFrame(t) {
    const raw = last ? t - last : 16;
    const dt = Math.min(50, raw);
    last = t;
    if (probe && rq > 0) {   // watch the first frames; step quality down on slow devices
      probe.push(raw);
      if (probe.length === 75) {
        const s = probe.slice(15).sort((a, b) => a - b), med = s[s.length >> 1];
        probe = med > 24 ? [] : null;
        if (med > 24) { rq = rq === 1 ? .5 : 0; if (!rq) { ctx.clearRect(0, 0, CW, CH); cv.style.display = 'none'; return; } sizeRain(); }
      }
    }
    ctx.clearRect(0, 0, CW, CH);
    const sl = wall.scrollLeft, st = wall.scrollTop;
    const pr = projOn && projBox ? { x: projBox.x - sl, y: projBox.y - st, w: projBox.w, h: projBox.h } : null;
    const nr = neonBox ? { x: neonBox.x - sl, y: neonBox.y - st, w: neonBox.w, h: neonBox.h } : null;
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (const d of drops) {
      d.y += d.v * dt;
      d.x += d.v * dt * WIND;
      if (d.y - d.l > CH || d.x > CW + 130) Object.assign(d, newDrop(false));
      const x2 = d.x - d.l * WIND, y2 = d.y - d.l;
      let k = d.a < .55 ? 0 : d.a < .88 ? 1 : 2;
      if (!mapOn) {
        if (inRect(d.x, d.y, pr, 0)) k = 3;
        else if (inRect(d.x, d.y, nr, 60)) k = 4;
      }
      paths[k].moveTo(d.x, d.y);
      paths[k].lineTo(x2, y2);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(190,205,226,.07)'; ctx.stroke(paths[0]);
    ctx.strokeStyle = 'rgba(200,214,232,.14)'; ctx.stroke(paths[1]);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(215,226,240,.24)'; ctx.stroke(paths[2]);
    ctx.strokeStyle = 'rgba(205,228,255,.5)'; ctx.stroke(paths[3]);
    ctx.strokeStyle = 'rgba(255,196,130,.42)'; ctx.stroke(paths[4]);
    rainRaf = requestAnimationFrame(rainFrame);
  }
  function rainRun() {
    cancelAnimationFrame(rainRaf);
    if (reduce() || document.hidden || !rq) { ctx.clearRect(0, 0, CW, CH); return; }
    last = 0;
    rainRaf = requestAnimationFrame(rainFrame);
  }

  /* ------------------------------------------------------------ rain sound (Web Audio, made on the fly) */
  const sound = { on: false, ctx: null, gain: null, timer: 0,
    build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ac = this.ctx = new AC();
      const len = ac.sampleRate * 4, buf = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913;
          d[i] = (b0 + b1 + b2 + w * .1848) * .09;
        }
      }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200;
      this.gain = ac.createGain(); this.gain.gain.value = 0;
      src.connect(hp).connect(lp).connect(this.gain).connect(ac.destination);
      src.start();
      return true;
    },
    drip() {
      if (!this.on) return;
      const ac = this.ctx, o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(1400 + Math.random() * 1800, t);
      o.frequency.exponentialRampToValueAtTime(500 + Math.random() * 300, t + .09);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.022 * this.level, t + .004);
      g.gain.exponentialRampToValueAtTime(.0001, t + .16);
      o.connect(g).connect(this.gain.context.destination);
      o.start(t); o.stop(t + .2);
      this.timer = setTimeout(() => this.drip(), 160 + Math.random() * 900);
    },
    level: 1,
    toggle() {
      if (!this.ctx && !this.build()) return;
      this.on = !this.on;
      this.ctx.resume();
      this.gain.gain.setTargetAtTime(this.on ? .55 * this.level : 0, this.ctx.currentTime, .5);
      clearTimeout(this.timer);
      if (this.on) this.drip();
      $('[data-sound]').setAttribute('aria-pressed', String(this.on));
    },
    duck(down) {
      if (!this.ctx) return;
      this.level = down ? .15 : 1;
      this.gain.gain.setTargetAtTime(this.on ? .55 * this.level : 0, this.ctx.currentTime, .3);
    },
  };
  $('[data-sound]').addEventListener('click', () => sound.toggle());

  /* ------------------------------------------------------------ lifecycle */
  document.addEventListener('visibilitychange', () => { rainRun(); projCheck(); });
  mqReduce.addEventListener && mqReduce.addEventListener('change', rainRun);
  let rsT = 0;
  addEventListener('resize', () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => {
      if (mapOn) exitMap();
      const key = nearest();
      sizeRain();
      measure();
      if (key) goTo(key, 0);
      wake();
    }, 180);
  });
  function start() {
    measure();
    const key = (location.hash || '').slice(1);
    goTo(boxes[key] ? key : 'new', 0);
    wake();
    sizeRain();
    rainRun();
    lightUp();
  }
  start();
  // fonts change text boxes: re-measure once they are ready
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); });
})();
