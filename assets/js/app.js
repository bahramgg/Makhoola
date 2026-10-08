/* ماخولا — پیکره‌ی رود
   کل سایت یک بدنه‌ی زنده است که با چرخاندن، کشیدن یا کلیدها پایین‌دستِ رود می‌رود
   و از فرمی به فرم دیگر می‌ریزد. متن‌ها روی آن ظاهر و محو می‌شوند. */
(function () {
  'use strict';
  const MK = window.MK;
  const root = document.documentElement;
  const DATA = JSON.parse(document.getElementById('mk-data').textContent);
  const STEPS = DATA.steps, LAST = STEPS.length - 1;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fa = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = () => innerWidth < 760;
  const byId = {};
  STEPS.forEach((s, i) => { byId[s.id] = i; });

  /* ---------------- حالت متنی (و جایگزین وقتی WebGL نیست) ---------------- */
  const textBtn = $('#t-text');
  function setText(on) {
    root.classList.toggle('text-mode', on);
    textBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('#archive').inert = !on;
    $('#panels').inert = on;
    if (on) { window.scrollTo(0, 0); $('#archive h1').setAttribute('tabindex', '-1'); $('#archive h1').focus({ preventScroll: true }); }
    else running = false, start();
  }
  textBtn.addEventListener('click', () => setText(!root.classList.contains('text-mode')));
  $$('[data-exit-text]').forEach((b) => b.addEventListener('click', () => setText(false)));

  let river;
  const cores = navigator.hardwareConcurrency || 4;
  const N = small() ? 8000 : cores <= 4 ? 13000 : 19000;
  try { river = MK.river = new MK.River($('#river'), N); }
  catch (err) {
    root.classList.add('no-gl');
    $('#gate').remove();
    setText(true);
    return;
  }
  $('#archive').inert = true;

  /* ---------------- جعبه‌ی هر فرم روی صفحه ---------------- */
  const fit = MK.fit;
  const BOX = {
    emblem: (W, H, f) => small() ? fit(f.aspect, W / 2, H * 0.45, W * 0.84, H * 0.56) : fit(f.aspect, W / 2, H * 0.5, W * 0.6, H * 0.76),
    moon: (W, H) => { if (small()) { const s = Math.min(W * 0.62, H * 0.34); return { x: W / 2 - s / 2, y: H * 0.25 - s / 2, w: s, h: s }; }
      const s = Math.min(H * 0.6, W * 0.38); return { x: W * 0.68 - s / 2, y: H * 0.47 - s / 2, w: s, h: s }; },
    cover: (W, H) => { if (small()) { const s = Math.min(W * 0.74, H * 0.36); return { x: W / 2 - s / 2, y: H * 0.27 - s / 2, w: s, h: s }; }
      const s = Math.min(H * 0.68, W * 0.4); return { x: W * 0.64 - s / 2, y: H * 0.5 - s / 2, w: s, h: s }; },
    rooster: (W, H, f) => small() ? fit(f.aspect, W / 2, H * 0.31, W * 0.62, H * 0.44) : fit(f.aspect, W * 0.5, H * 0.53, W * 0.36, H * 0.84),
    face: (W, H, f) => small() ? fit(f.aspect, W / 2, H * 0.31, W * 0.8, H * 0.46) : fit(f.aspect, W * 0.63, H * 0.5, W * 0.42, H * 0.84),
    screen: (W, H) => { if (small()) { const w = W * 0.92; return { x: W * 0.04, y: H * 0.17, w, h: w * 9 / 16 }; }
      const w = Math.min(W * 0.52, H * 0.6 * 16 / 9), h = w * 9 / 16; return { x: W * 0.43 - w / 2, y: H * 0.5 - h / 2, w, h }; },
  };
  const boxFor = (kind) => function (W, H) { return BOX[kind](W, H, this); };

  /* ---------------- فرم‌ها ---------------- */
  const forms = [];
  const emblem = MK.formEmblem(DATA.emblem, N, null);
  emblem.box = boxFor('emblem'); emblem.scale = 1.7;
  const ring = MK.formRing(N);
  river.prep(ring);
  river.override = ring;
  river.scatter();

  const STREAM_LANES = (() => {
    const c1 = [0.94, 0.89, 0.78, 0.75], c2 = [0.94, 0.89, 0.78, 0.38], c3 = [0.83, 0.23, 0.15, 0.85];
    return [
      { y: (W, H) => (W < 760 ? 0.16 : 0.15), amp: 0.025, k: 0.006, p: 0, speed: 1, width: 26, color: c1 },
      { y: () => 0.31, amp: 0.02, k: 0.0048, p: 1.4, speed: 0.7, width: 16, color: c2, size: 0.8 },
      { y: () => 0.47, amp: 0.03, k: 0.0062, p: 2.6, speed: 1.2, width: 30, color: c3 },
      { y: () => 0.63, amp: 0.018, k: 0.0052, p: 4.1, speed: 0.8, width: 14, color: c2, size: 0.8 },
      { y: () => 0.78, amp: 0.022, k: 0.0057, p: 5.2, speed: 1.1, width: 22, color: c1 },
    ];
  })();
  const PATH = (u, W, H) => small()
    ? [W * (0.5 + 0.3 * Math.sin(u * Math.PI * 2 * 1.25 + 0.5)), H * (0.24 + 0.68 * u)]
    : [W * (0.92 - 0.84 * u), H * (0.6 + 0.16 * Math.sin(u * Math.PI * 2 * 1.1 + 0.3) + 0.05 * Math.sin(u * Math.PI * 2 * 3.2 + 1))];

  const moonVideo = document.createElement('video');
  moonVideo.muted = true; moonVideo.loop = true; moonVideo.playsInline = true; moonVideo.preload = 'none';
  moonVideo.setAttribute('muted', ''); moonVideo.setAttribute('playsinline', ''); moonVideo.setAttribute('aria-hidden', 'true');
  moonVideo.className = 'offscreen-video';
  // اگر مرورگر H.264 ندارد، نسخه‌ی WebM
  moonVideo.src = 'assets/video/nemikaham-moon.' + (moonVideo.canPlayType('video/mp4; codecs="avc1.4D401E"') ? 'mp4' : 'webm');
  document.body.appendChild(moonVideo);

  const pending = [];
  function build(i) {
    const s = STEPS[i];
    switch (s.kind) {
      case 'emblem': return emblem;
      case 'moon': {
        const f = MK.formMoon(N, null); f.box = boxFor('moon');
        // تیزر آلبوم درون ماه؛ تا ویدیو آماده نشده، خود ماه
        f.reveal.video = moonVideo; f.reveal.circle = true; f.reveal.fade = 0.82; f.reveal.alpha = 1;
        return f;
      }
      case 'streams': return MK.formStreams(N, STREAM_LANES);
      case 'path': return MK.formPath(N, PATH);
      case 'dust': { const f = MK.formDust(N); f.alpha = 1; return f; }
      case 'screen': { const f = MK.formScreen(N, null); f.box = boxFor('screen'); return f; }
      case 'sea': return MK.formSea(N);
      case 'cover': return MK.formImage(s.img, N, 'color', { floor: 0.16, lift: 1.12 }, null).then((f) => { f.box = boxFor('cover'); f.scale = 1.8; f.reveal = { a: 0, img: f.img, alpha: 0.94, seed: i }; return f; });
      case 'rooster': return MK.formImage(s.img, N, 'bright', { keepColor: true, gamma: 0.7, lift: 1.05 }, null).then((f) => { f.box = boxFor('rooster'); f.scale = 1.45; f.reveal = { a: 0, img: f.img, alpha: 0.9, seed: i }; return f; });
      case 'face': return MK.formImage(s.img, N, 'bright', { gamma: 1.15, color: [0.94, 0.89, 0.78], sizeByLum: true, size: 1.9 }, null).then((f) => { f.box = boxFor('face'); f.reveal = { a: 0, img: f.img, alpha: 0.5, seed: i }; return f; });
    }
  }
  // تا فرم واقعی آماده شود، غبار جایش می‌ایستد
  for (let i = 0; i <= LAST; i++) {
    const r = build(i);
    if (r && typeof r.then === 'function') { river.add(i, MK.formDust(N)); pending.push(r.then((f) => { river.add(i, f); forms[i] = f; return f; }).catch(() => null)); }
    else { river.add(i, r); forms[i] = r; }
  }
  forms[0] = emblem;

  /* ---------------- ورود ---------------- */
  const gate = $('#gate');
  const pcEl = $('.gate__pc');
  let loaded = 0;
  const total = pending.length + 1;
  const progress = () => { pcEl.textContent = fa(String(Math.round(loaded / total * 99)).padStart(2, '0')); };
  progress();
  pending.forEach((p) => p.then(() => { loaded++; progress(); }));
  let entered = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    loaded++; progress();
    $$('.gate__btn').forEach((b) => { b.disabled = false; });
    root.classList.add('ready');
  });
  Promise.all(pending).then(() => { pcEl.textContent = fa('99'); root.classList.add('loaded'); });
  $$('.gate__btn').forEach((b) => b.addEventListener('click', () => enter(b.dataset.sound === '1')));
  function enter(sound) {
    if (entered) return;
    entered = true;
    if (sound) { MK.sound.set(true); }
    syncSound();
    gate.classList.add('gate--out');
    root.classList.add('entered');
    setTimeout(() => gate.remove(), 1400);
    river.override = null;
    river.agit = 1;
    const h = decodeURIComponent(location.hash.slice(1));
    if (h && byId[h] != null) { goal = pos = byId[h]; river.pos = pos; }
    lastInput = now();
  }

  /* ---------------- صدا ---------------- */
  const sndBtn = $('#t-sound');
  function syncSound() { sndBtn.setAttribute('aria-pressed', MK.sound.on ? 'true' : 'false'); sndBtn.classList.toggle('is-on', MK.sound.on); }
  sndBtn.addEventListener('click', () => { MK.sound.set(!MK.sound.on); syncSound(); });

  /* ---------------- حرکت در رود ---------------- */
  let pos = 0, goal = 0, gestureStart = 0, gestureAt = 0, lastDir = 1, snapped = true, lastInput = 0;
  const now = () => performance.now();
  const modalOpen = () => !$('#viewer').hidden;
  const blocked = () => !entered || root.classList.contains('text-mode') || modalOpen();
  function go(i, jump) {
    i = clamp(Math.round(i), 0, LAST);
    // پرش مستقیم: ذره‌ها از هر جا که هستند یک‌راست به فرم مقصد می‌روند
    if (jump && Math.abs(i - pos) > 1.2) { pos = i; river.agit = 1; settle = 0; }
    goal = i; snapped = true; lastInput = now();
  }
  function nudge(d) { go(Math.round(goal) + d); }
  addEventListener('wheel', (e) => {
    if (blocked()) return;
    if (e.target.closest && e.target.closest('[data-scroll]') && scrollable(e.target.closest('[data-scroll]'), e.deltaY)) return;
    e.preventDefault();
    const t = now();
    let dy = e.deltaY * (e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? innerHeight : 1);
    if (Math.abs(e.deltaX) > Math.abs(dy)) dy = -e.deltaX; // در راست‌به‌چپ، کشیدن به چپ یعنی جلو
    if (t - gestureAt > 260 || snapped) { gestureStart = Math.round(goal); snapped = false; }
    gestureAt = t; lastInput = t;
    if (dy) lastDir = Math.sign(dy);
    goal = clamp(goal + dy * 0.0032, Math.max(0, gestureStart - 1), Math.min(LAST, gestureStart + 1));
  }, { passive: false });
  function scrollable(el, dy) { return dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0; }

  let touch = null;
  addEventListener('touchstart', (e) => {
    if (blocked() || e.touches.length > 1) return;
    const sc = e.target.closest && e.target.closest('[data-scroll]');
    touch = { y: e.touches[0].clientY, x: e.touches[0].clientX, g: Math.round(goal), sc, t: now(), moved: false };
    lastInput = now();
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!touch || blocked()) return;
    const dy = touch.y - e.touches[0].clientY, dx = e.touches[0].clientX - touch.x;
    if (touch.sc && touch.sc.scrollHeight > touch.sc.clientHeight + 2) return;
    const d = Math.abs(dy) > Math.abs(dx) ? dy : dx * 0.8;
    if (Math.abs(d) > 8) touch.moved = true;
    if (!touch.moved) return;
    e.preventDefault();
    goal = clamp(touch.g + d / (innerHeight * 0.55), Math.max(0, touch.g - 1), Math.min(LAST, touch.g + 1));
    lastDir = Math.sign(d) || lastDir; gestureAt = now(); snapped = false; lastInput = now();
  }, { passive: false });
  addEventListener('touchend', () => {
    if (!touch) return;
    if (touch.moved) { const d = goal - touch.g; go(touch.g + (Math.abs(d) > 0.12 ? Math.sign(d) : 0)); }
    touch = null;
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen()) { closeViewer(); return; }
    if (!entered && (e.key === 'Enter') && document.activeElement === document.body) { enter(false); return; }
    if (blocked() || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const k = e.key;
    if (['ArrowDown', 'PageDown', 'ArrowLeft'].includes(k) || (k === ' ' && !/^(BUTTON|A|SUMMARY|INPUT|TEXTAREA)$/.test(tag))) { e.preventDefault(); nudge(1); }
    else if (['ArrowUp', 'PageUp', 'ArrowRight'].includes(k)) { e.preventDefault(); nudge(-1); }
    else if (k === 'Home') { e.preventDefault(); go(0, true); }
    else if (k === 'End') { e.preventDefault(); go(LAST, true); }
    lastInput = now();
  });
  $('#next').addEventListener('click', () => { if (Math.round(goal) >= LAST) go(0, true); else nudge(1); });

  // پیوندهای درونی (فهرست، نشان، خبر)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (!a) return;
    const i = byId[a.dataset.go];
    if (i == null) return;
    e.preventDefault();
    if (!entered) return;
    go(i, true);
    closeIndex();
  });
  addEventListener('hashchange', () => {
    const i = byId[decodeURIComponent(location.hash.slice(1))];
    if (i != null && entered && i !== Math.round(goal)) go(i, true);
  });

  /* ---------------- فهرست با حروف به‌هم‌ریخته ---------------- */
  const idx = $('#idx'), idxBtn = $('.idx__btn');
  idxBtn.addEventListener('click', () => { const o = idx.classList.toggle('open'); idxBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  function closeIndex() { idx.classList.remove('open'); idxBtn.setAttribute('aria-expanded', 'false'); }
  const scrambleChars = '۱۲۳۴۵۶۷۸۹۰ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
  $$('.gl').forEach((el) => {
    const a = el.dataset.a, b = el.dataset.b, rest = el.textContent;
    let timer = null;
    const run = (target, chaos) => {
      clearInterval(timer);
      let n = 0;
      timer = setInterval(() => {
        n++;
        el.textContent = [...target].map((c, i) => (i < n / 1.5 || c === ' ' || c === '‌') ? c : (Math.random() < chaos ? scrambleChars[(Math.random() * scrambleChars.length) | 0] : (b[i] || c))).join('');
        if (n > target.length * 1.5 + 2) { clearInterval(timer); el.textContent = target; }
      }, 34);
    };
    const link = el.closest('a');
    link.addEventListener('mouseenter', () => run(a, 0.5));
    link.addEventListener('focus', () => run(a, 0.5));
    link.addEventListener('mouseleave', () => { if (!link.classList.contains('cur')) run(rest, 0.3); });
    link.addEventListener('blur', () => { if (!link.classList.contains('cur')) run(rest, 0.3); });
    el._run = run; el._rest = rest;
  });
  const idxLinks = $$('#idx-list a').map((a) => ({ a, i: byId[a.dataset.go], gl: $('.gl', a) }));

  /* ---------------- پنل‌ها ---------------- */
  const panels = $$('.panel, .under').map((el) => ({ el, i: +el.dataset.step, v: -1, on: null }));
  panels.forEach((p) => { p.el.inert = true; });
  const countEl = $('[data-count]'), flowEl = $('[data-flow]');
  let cur = -1;
  function updatePanels() {
    for (const p of panels) {
      const d = Math.abs(pos - p.i);
      const v = clamp(1 - d * 2.4, 0, 1);
      if (Math.abs(v - p.v) > 0.004) { p.el.style.setProperty('--v', v.toFixed(3)); p.v = v; }
      const on = d < 0.3;
      if (on !== p.on) { p.on = on; p.el.classList.toggle('on', on); p.el.inert = !on; }
      const hid = v === 0;
      if (hid !== p.hid) { p.hid = hid; p.el.style.visibility = hid ? 'hidden' : ''; }
    }
    const r = Math.round(pos);
    if (r !== cur) {
      const prev = cur;
      cur = r;
      countEl.textContent = fa(String(r + 1).padStart(2, '0'));
      const ch = STEPS[r].ch;
      root.dataset.ch = ch; root.dataset.kind = STEPS[r].kind;
      let best = null;
      idxLinks.forEach((l) => { if (l.i <= r) best = l; });
      // «خروس» داخل آثار است؛ فقط وقتی روی خودش هستیم روشن شود
      if (STEPS[r].ch === 'works' || STEPS[r].ch === 'khoroos') best = idxLinks.find((l) => l.a.dataset.go === (STEPS[r].ch === 'khoroos' ? 'khoroos' : DATA.steps[DATA.works[0]].id));
      idxLinks.forEach((l) => {
        const c = l === best;
        if (c !== l.a.classList.contains('cur')) { l.a.classList.toggle('cur', c); if (c) l.a.setAttribute('aria-current', 'step'); else l.a.removeAttribute('aria-current'); l.gl._run(c ? l.gl.dataset.a : l.gl._rest, 0.3); }
      });
      if (entered && prev >= 0) {
        MK.sound.step(r);
        history.replaceState(null, '', '#' + STEPS[r].id);
        onLeave(prev); onEnter(r);
      }
      $('#next').classList.toggle('up', r === LAST);
    }
    flowEl.style.transform = `scaleX(${(pos / LAST).toFixed(4)})`;
  }

  /* ---------------- نشان: حرف‌ها نت‌اند و در به فصل‌ها ---------------- */
  const glyphs = DATA.emblem.glyphs.map((g, k) => ({ k, b: g.b, cx: (g.b[0] + g.b[2]) / 2, cy: (g.b[1] + g.b[3]) / 2 }));
  // نت: حرف بالاتر، نت زیرتر
  [...glyphs].sort((a, b) => a.cy - b.cy).forEach((g, r) => { g.note = 10 - r; });
  // در: به ترتیب زاویه از بالا، خلاف عقربه‌ها (راست‌به‌چپ)
  const ECX = 376, ECY = 465;
  const doors = [['nemikaham', 'نمی‌کاهم'], [DATA.steps[DATA.works[0]].id, 'آثار'], ['khoroos', 'خروس'], ['rud', 'رود'], ['shows', 'اجراها'], [DATA.steps[DATA.band].id, 'گروه'], ['stage', 'صحنه'], ['video', 'ویدیو'], ['contact', 'تماس']];
  const ang = (g) => (2 * Math.PI - Math.atan2(g.cx - ECX, -(g.cy - ECY))) % (2 * Math.PI);
  [...glyphs].sort((a, b) => ang(a) - ang(b))
    .forEach((g, r) => { if (doors[r]) { g.go = doors[r][0]; g.label = doors[r][1]; } });
  const groupIdx = glyphs.map(() => []);
  for (let i = 0; i < N; i++) { const g = emblem.group[i]; if (g > 0) groupIdx[g - 1].push(i); }
  const glabels = $('.glabels');
  glyphs.forEach((g) => {
    if (!g.go) return;
    const a = document.createElement('a');
    a.href = '#' + g.go; a.dataset.go = g.go; a.className = 'glabel'; a.textContent = g.label; a.tabIndex = -1;
    glabels.appendChild(a); g.el = a;
  });
  function placeGlyphs() {
    const b = emblem.b; if (!b) return;
    glyphs.forEach((g) => {
      g.sx = b.x + (g.cx - 100) / 552 * b.w; g.sy = b.y + (g.cy - 34) / 702 * b.h;
      g.r = Math.max(26, (g.b[2] - g.b[0]) / 552 * b.w * 0.7, (g.b[3] - g.b[1]) / 702 * b.h * 0.6);
      if (g.el) {
        const ex = b.x + (ECX - 100) / 552 * b.w, ey = b.y + (ECY - 34) / 702 * b.h;
        const dx = g.sx - ex, dy = g.sy - ey, d = Math.hypot(dx, dy) || 1;
        const off = small() ? 34 : 54;
        g.el.style.transform = `translate(${(g.sx + dx / d * off).toFixed(1)}px, ${(g.sy + dy / d * off).toFixed(1)}px) translate(-50%, -50%)`;
      }
    });
  }
  let hoverGlyph = -1;
  function glyphAt(x, y) {
    for (const g of glyphs) if (g.sx != null && Math.hypot(x - g.sx, y - g.sy) < g.r) return g.k;
    return -1;
  }
  function playGlyph(k, vel) {
    const g = glyphs[k];
    MK.sound.pluck(g.note, vel);
    for (const i of groupIdx[k]) river.hi[i] = 1;
    river.shock(g.sx, g.sy, 2.2, g.r * 2.4);
    if (g.el) { g.el.classList.add('lit'); clearTimeout(g.t); g.t = setTimeout(() => g.el.classList.remove('lit'), 900); }
  }

  /* ---------------- اشاره‌گر ---------------- */
  const P = river.pointer;
  const cursor = $('.cursor');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let cx = -100, cy = -100;
  if (fine) {
    document.addEventListener('pointerover', (e) => { cursor.classList.toggle('is-link', !!e.target.closest('a,button,summary,.print,.stone')); });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  }
  function moveCursor() {
    if (!fine || !P.on) return;
    root.classList.add('has-cursor');
    cx += (P.x - cx) * 0.3; cy += (P.y - cy) * 0.3;
    cursor.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
  }
  let pdown = null;
  addEventListener('pointermove', (e) => {
    P.x = e.clientX; P.y = e.clientY; P.on = entered && !root.classList.contains('text-mode');
    lastInput = now();
    if (wake()) return;
    if (cur === 0 && Math.abs(pos) < 0.08) {
      const k = glyphAt(P.x, P.y);
      if (k !== hoverGlyph) { hoverGlyph = k; if (k >= 0) playGlyph(k, 0.55 + Math.random() * 0.2); }
      root.classList.toggle('on-glyph', k >= 0 && !!glyphs[k].go);
    }
    if (STEPS[cur] && STEPS[cur].kind === 'dust') setLight(e.clientX, e.clientY);
    if (STEPS[cur] && STEPS[cur].kind === 'moon') { const f = forms[cur]; root.classList.toggle('on-glyph', !!(f && f.b && Math.hypot(P.x - (f.b.x + f.b.w / 2), P.y - (f.b.y + f.b.h / 2)) < f.b.w / 2)); }
  }, { passive: true });
  addEventListener('pointerleave', () => { P.on = false; root.classList.remove('has-cursor'); });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) { P.on = false; root.classList.remove('has-cursor'); } });
  addEventListener('pointerdown', (e) => {
    lastInput = now();
    if (wake()) return;
    pdown = { x: e.clientX, y: e.clientY, t: now() };
    if (e.pointerType !== 'mouse') { P.x = e.clientX; P.y = e.clientY; P.on = true; }
  });
  addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') P.on = false;
    if (!pdown || !entered || blocked()) return;
    const moved = Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y) > 10;
    pdown = null;
    if (moved || e.target.closest('a,button,summary,details,.panel .credits,iframe')) return;
    canvasClick(e.clientX, e.clientY);
  });
  function canvasClick(x, y) {
    const s = STEPS[cur];
    if (!s) return;
    if (s.kind === 'emblem' && Math.abs(pos) < 0.1) {
      const k = glyphAt(x, y);
      if (k >= 0) { playGlyph(k, 0.8); if (glyphs[k].go) setTimeout(() => go(byId[glyphs[k].go], true), 220); return; }
      const b = emblem.b;
      if (b && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { [0, 4, 7].forEach((n, j) => MK.sound.pluck(n, 0.5, j * 0.06)); river.shock(x, y, 9, 260); }
      return;
    }
    if (s.kind === 'moon') {
      const f = forms[cur];
      if (f && f.b && Math.hypot(x - (f.b.x + f.b.w / 2), y - (f.b.y + f.b.h / 2)) < f.b.w / 2) { openViewer('teaser', 0); return; }
    }
    if (s.kind === 'rooster') {
      const f = forms[cur];
      if (f && f.b && x > f.b.x && x < f.b.x + f.b.w && y > f.b.y && y < f.b.y + f.b.h) { crow(); }
      return;
    }
    river.shock(x, y, 6, 200);
  }
  function crow() {
    const f = forms[cur];
    MK.sound.crow();
    if (f.reveal) f.reveal.a = 0;
    settle = -0.4;
    river.shock(f.b.x + f.b.w * 0.45, f.b.y + f.b.h * 0.22, 16, Math.max(f.b.w, f.b.h) * 1.1);
    root.classList.add('crowing'); setTimeout(() => root.classList.remove('crowing'), 900);
  }

  /* ---------------- محافظ صفحه (دی‌وی‌دی) ---------------- */
  const dvd = MK.formDVD(emblem, [[0.94, 0.89, 0.78], [0.86, 0.25, 0.16], [0.78, 0.6, 0.35], [0.55, 0.72, 0.8]], () => MK.sound.pluck((Math.random() * 11) | 0, 0.4));
  dvd.x = new Float32Array(N); dvd.y = new Float32Array(N);
  let idle = false;
  function wake() {
    if (!idle) return false;
    idle = false; river.override = null; root.classList.remove('idle');
    return true;
  }

  /* ---------------- ساعت رشت (و ساعت شما) ---------------- */
  const fmtT = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtD0 = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtD = { format: (d) => { const p = {}; fmtD0.formatToParts(d).forEach((x) => { p[x.type] = x.value; }); return `${p.weekday} ${p.day} ${p.month} ${p.year}`; } };
  const fmtY = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const elR = $('[data-clock="rasht"]'), elY = $('[data-clock="you"]'), elBig = $('[data-clock="big"]');
  const tzYou = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function tick() {
    const d = new Date();
    const t = fmtT.format(d);
    elR.textContent = `رشت ${t} · ${fmtD.format(d)}`;
    elBig.textContent = t;
    if (tzYou && tzYou !== 'Asia/Tehran' && fmtY.format(d) !== t) elY.textContent = `ساعت شما ${fmtY.format(d)}`;
    else elY.textContent = '';
  }
  tick(); setInterval(tick, 1000);

  /* ---------------- رود: شعر روی جریان ---------------- */
  // متن راست‌به‌چپ روی مسیر: شروعش انتهای مسیر است و به عقب می‌رود (مثل نسخه‌ی قبل)
  const rudSvg = $('.rud__svg');
  const NS = 'http://www.w3.org/2000/svg';
  const RUD = [{ lane: 0, size: [22, 2.5, 38], speed: 26 }, { lane: 2, size: [22, 2.6, 40], speed: 34 }, { lane: 4, size: [17, 1.8, 27], speed: 18 }];
  const rudLines = [];
  function placeRud() {
    const W = innerWidth, H = innerHeight;
    rudSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    rudSvg.innerHTML = '';
    rudLines.length = 0;
    DATA.rud.forEach((line, k) => {
      const C = RUD[k], L = STREAM_LANES[C.lane];
      const size = clamp(W * C.size[1] / 100, C.size[0], C.size[2]);
      let d = '';
      for (let x = -0.06 * W; x <= 1.06 * W; x += Math.max(6, W / 180)) {
        const y = H * L.y(W, H) + Math.sin(x * L.k + L.p) * L.amp * H - size * 0.9;
        d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('id', 'rp' + k); path.setAttribute('d', d); path.setAttribute('fill', 'none');
      rudSvg.appendChild(path);
      const words = line + ' ';
      const probe = document.createElementNS(NS, 'text');
      probe.setAttribute('font-size', size.toFixed(1)); probe.setAttribute('class', 'rl'); probe.textContent = words;
      rudSvg.appendChild(probe);
      const seg = probe.getComputedTextLength() || size * words.length * 0.4;
      probe.remove();
      const len = path.getTotalLength();
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('font-size', size.toFixed(1)); text.setAttribute('class', 'rl rl--' + k);
      const tp = document.createElementNS(NS, 'textPath');
      tp.setAttribute('href', '#rp' + k);
      tp.textContent = words.repeat(Math.ceil((len + seg) / seg) + 1);
      text.appendChild(tp); rudSvg.appendChild(text);
      rudLines.push({ tp, len, seg, off: Math.random() * seg, speed: C.speed });
    });
  }
  let rudLast = 0;
  function animRud(t) {
    const dt = Math.min(0.06, t - rudLast || 0); rudLast = t;
    for (const L of rudLines) {
      L.off = (((L.off - L.speed * dt) % L.seg) + L.seg) % L.seg;
      L.tp.setAttribute('startOffset', (L.len + L.off).toFixed(1));
    }
  }
  if (document.fonts) document.fonts.load('30px Nastaliq', 'ماخ اولا').then(placeRud).catch(() => {});

  /* ---------------- اجراها: سنگ‌ها روی مسیر ---------------- */
  const stones = $$('.stone');
  const pile = $('.pile'), showcap = $('.showcap');
  let lastYear = '';
  stones.forEach((b, k) => {
    const y = DATA.shows[k].y;
    if (y !== lastYear) { b.classList.add('first'); lastYear = y; }
    b.addEventListener('mouseenter', () => showOn(k));
    b.addEventListener('focus', () => showOn(k));
    b.addEventListener('click', () => { showOn(k); if (DATA.shows[k].p) openViewer('show', k); });
  });
  function placeStones() {
    const f = forms[byId.shows]; if (!f || !f.at) return;
    const n = stones.length;
    stones.forEach((b, k) => {
      const p = f.at(0.03 + 0.94 * k / (n - 1), innerWidth, innerHeight);
      b.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -50%)`;
      b._x = p[0]; b._y = p[1];
    });
  }
  let pileZ = 1;
  function paste(k) {
    const s = DATA.shows[k], b = stones[k];
    if (!s.p || b._pasted || !b._x) return;
    b._pasted = true;
    const im = new Image();
    im.src = s.p + '-sm.webp'; im.alt = ''; im.decoding = 'async';
    const W = innerWidth, H = innerHeight;
    const pw = small() ? W * 0.3 : Math.min(210, W * 0.15);
    let x = b._x + (Math.random() - 0.5) * pw * 1.4, y = b._y + (b._y > H * 0.55 ? -1 : 1) * (pw * 0.9 + Math.random() * 40);
    x = clamp(x, pw * 0.6, W - pw * 0.6); y = clamp(y, H * 0.12 + pw * 0.7, H - pw * 0.8);
    im.style.cssText = `--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--r:${((Math.random() - 0.5) * 16).toFixed(1)}deg;--w:${pw.toFixed(0)}px;z-index:${pileZ++}`;
    im._stone = b;
    pile.appendChild(im);
    const all = pile.children;
    if (all.length > 7) { const old = all[0]; old.classList.add('gone'); setTimeout(() => { old.remove(); old._stone._pasted = false; }, 600); }
  }
  function showOn(k) {
    const s = DATA.shows[k], b = stones[k];
    const status = s.s ? ` · <b class="st${/SOLD|تکمیل/.test(s.s) ? ' st--red' : ''}">${s.s}</b>` : '';
    showcap.innerHTML = `<span class="showcap__d">${DATA.city[s.c]}، ${s.d}</span>${[s.v, s.n].filter(Boolean).map((x) => ' · ' + x).join('')}${status}`;
    stones.forEach((x) => x.classList.toggle('cur', x === b));
    river.shock(b._x, b._y, 3, 70);
    MK.sound.pluck(Math.max(0, 10 - Math.round(k / (stones.length - 1) * 10)), 0.35);
    paste(k);
  }

  /* ---------------- صحنه: نور دست شماست ---------------- */
  const prints = $$('.print'), stageDark = $('.stage__dark');
  let lightX = innerWidth / 2, lightY = innerHeight / 2, lightAuto = true;
  function setLight(x, y) { lightX = x; lightY = y; lightAuto = false; clearTimeout(setLight.t); setLight.t = setTimeout(() => { lightAuto = true; }, 4000); }
  function placePrints() {
    const W = innerWidth, H = innerHeight, n = prints.length;
    const cols = small() ? 3 : 6, rows = Math.ceil(n / cols);
    prints.forEach((el, k) => {
      const c = k % cols, r = (k / cols) | 0;
      const cw = W / cols, rh = H * (small() ? 0.82 : 0.9) / rows;
      const ar = parseFloat(el.style.getPropertyValue('--ar')) || 1.4;
      const w = Math.min(cw * (0.78 + ((k * 37) % 10) / 40), rh * ar * 0.92);
      const x = W - (c + 0.5) * cw + Math.sin(k * 2.3) * cw * 0.1;
      const y = H * (small() ? 0.16 : 0.08) + (r + 0.5) * rh + Math.cos(k * 1.7) * rh * 0.1;
      el.style.cssText = `--ar:${ar};--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--w:${w.toFixed(0)}px;--r:${(Math.sin(k * 3.1) * 3.5).toFixed(1)}deg`;
    });
  }
  prints.forEach((el) => el.addEventListener('click', () => openViewer('photo', +el.dataset.photo)));

  /* ---------------- ویدیو ---------------- */
  const screenEl = $('.screen'), screenImg = $('.screen__img'), playBtn = $('.screen__play');
  let vidCur = 0;
  $$('.vid').forEach((b) => b.addEventListener('click', () => {
    vidCur = +b.dataset.video;
    $$('.vid').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    stopVideo();
    screenImg.src = `assets/img/video/${DATA.videos[vidCur].id}.webp`;
    playBtn.setAttribute('aria-label', `پخش «${DATA.videos[vidCur].t}»`);
    MK.sound.pluck(3 + vidCur, 0.4);
  }));
  playBtn.addEventListener('click', () => {
    const v = DATA.videos[vidCur];
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
    f.title = v.t; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
    screenEl.appendChild(f); screenEl.classList.add('playing');
    if (MK.sound.on) { MK.sound.set(false); syncSound(); screenEl._sound = true; }
  });
  function stopVideo() {
    const f = $('iframe', screenEl); if (f) f.remove();
    screenEl.classList.remove('playing');
    if (screenEl._sound) { screenEl._sound = false; MK.sound.set(true); syncSound(); }
  }
  function placeScreen() {
    const f = forms[byId.video]; if (!f || !f.b) return;
    const b = f.b;
    screenEl.style.cssText = `left:${b.x.toFixed(0)}px;top:${b.y.toFixed(0)}px;width:${b.w.toFixed(0)}px;height:${b.h.toFixed(0)}px`;
  }

  /* ---------------- نمایشگر (پوستر و عکس) ---------------- */
  const viewer = $('#viewer'), vMedia = $('.viewer__media', viewer), vCap = $('figcaption', viewer);
  let vList = [], vI = 0, vKind = '', vBack = null;
  function openViewer(kind, k) {
    vKind = kind; vBack = document.activeElement;
    vList = kind === 'show' ? DATA.shows.map((s, i) => ({ s, i })).filter((x) => x.s.p) : kind === 'teaser' ? [{ i: 0 }] : DATA.photos.map((p, i) => ({ p, i }));
    viewer.classList.toggle('viewer--single', vList.length < 2);
    vI = Math.max(0, vList.findIndex((x) => x.i === k));
    renderViewer();
    viewer.hidden = false; root.classList.add('viewing');
    $('.viewer__close', viewer).focus();
  }
  function renderViewer() {
    const it = vList[vI];
    let src, cap;
    if (vKind === 'teaser') {
      vMedia.innerHTML = '<video poster="assets/video/nemikaham-teaser.webp" controls autoplay playsinline><source src="assets/video/nemikaham-teaser.mp4" type="video/mp4"><source src="assets/video/nemikaham-teaser.webm" type="video/webm"></video>';
      vCap.textContent = 'تیزر آلبوم «نمی‌کاهم» · ویدیو: هومن فاخته · کانال تلگرام ماخولا، ۱۵ مهر ۱۴۰۵';
      if (MK.sound.on) { MK.sound.set(false); syncSound(); viewer._sound = true; }
      const v = $('video', vMedia); v.play().catch(() => {});
      return;
    }
    if (vKind === 'show') { const s = it.s; src = s.p + '.webp'; cap = [DATA.city[s.c] + '، ' + s.d, s.v, s.n, s.s].filter(Boolean).join(' · '); }
    else { src = it.p.s; cap = it.p.c; }
    vMedia.innerHTML = `<img src="${src}" alt="${cap.replace(/"/g, '&quot;')}">`;
    vCap.textContent = cap;
  }
  function closeViewer() {
    viewer.hidden = true; root.classList.remove('viewing');
    vMedia.innerHTML = '';
    if (viewer._sound) { viewer._sound = false; MK.sound.set(true); syncSound(); }
    if (vBack) vBack.focus({ preventScroll: true });
  }
  $$('[data-teaser]').forEach((b) => b.addEventListener('click', () => openViewer('teaser', 0)));
  $('.viewer__close', viewer).addEventListener('click', closeViewer);
  $('.viewer__prev', viewer).addEventListener('click', () => { vI = (vI - 1 + vList.length) % vList.length; renderViewer(); });
  $('.viewer__next', viewer).addEventListener('click', () => { vI = (vI + 1) % vList.length; renderViewer(); });
  viewer.addEventListener('click', (e) => { if (e.target === viewer) closeViewer(); });
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { vI = (vI + 1) % vList.length; renderViewer(); }
    if (e.key === 'ArrowRight') { vI = (vI - 1 + vList.length) % vList.length; renderViewer(); }
    if (e.key === 'Tab') { const f = $$('button', viewer); const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  });

  /* ---------------- ورود و خروج هر فصل ---------------- */
  function onEnter(i) {
    const k = STEPS[i].kind;
    river.pointer.r = k === 'moon' ? 150 : k === 'face' ? 70 : k === 'emblem' ? 90 : 110;
    river.pointer.push = k === 'moon' ? 1.6 : 1;
    if (k === 'path' && !pile.children.length) { const n = stones.length; [n - 3, n - 2, n - 1].forEach((j, q) => setTimeout(() => paste(j), 500 + q * 260)); }
  }
  function onLeave(i) {
    const k = STEPS[i].kind;
    if (k === 'screen') stopVideo();
    if (k === 'path') { showcap.textContent = ''; }
    hoverGlyph = -1; root.classList.remove('on-glyph');
  }

  /* ---------------- اندازه‌ی صفحه ---------------- */
  function layoutAll() {
    river.resize();
    placeGlyphs(); placeStones(); placePrints(); placeScreen(); placeRud();
  }
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layoutAll, 140); });
  Promise.all(pending).then(() => { placeStones(); placeScreen(); });
  pending.forEach((p) => p.then(() => { placeScreen(); }));

  /* ---------------- حلقه‌ی اصلی ---------------- */
  let running = false, last = 0, settle = 0, prevPos = 0;
  function start() { if (running) return; running = true; last = now(); requestAnimationFrame(loop); }
  function loop(tn) {
    if (!running) return;
    if (root.classList.contains('text-mode') || document.hidden) { running = false; return; }
    const dt = Math.min(0.05, (tn - last) / 1000 || 0.016);
    last = tn;
    const t = tn / 1000;
    // جاافتادن بعد از چرخاندن
    if (!snapped && now() - gestureAt > 170 && !touch) {
      const g = goal;
      goal = lastDir > 0 ? Math.ceil(g - 0.14) : Math.floor(g + 0.14);
      goal = clamp(goal, 0, LAST); snapped = true;
    }
    const ease = reduce ? 1 : 1 - Math.exp(-dt * 4.2);
    pos += (goal - pos) * ease;
    if (Math.abs(goal - pos) < 0.0004) pos = goal;
    const speed = Math.abs(pos - prevPos) / dt; prevPos = pos;
    const frac = Math.abs(pos - Math.round(pos));
    const targetAg = Math.min(1, frac * 3 + speed * 0.5);
    river.agit += (targetAg - river.agit) * (targetAg > river.agit ? 0.3 : 0.04);
    if (reduce) river.agit = Math.min(river.agit, 0.15);
    river.pos = pos;
    // تصویر واقعی بعد از نشستن ذره‌ها پدیدار می‌شود
    const rI = Math.round(pos);
    if (frac < 0.02 && speed < 0.05) settle += dt; else settle = 0;
    for (let i = 0; i <= LAST; i++) {
      const f = forms[i]; if (!f || !f.reveal) continue;
      const r = f.reveal;
      if (!r.tex && r.img && Math.abs(i - pos) < 2) r.tex = river.texture(r.img);
      const want = i === rI && settle > 0.9 ? 1 : 0;
      r.a += (want - r.a) * (want ? Math.min(1, dt * 1.5) : Math.min(1, dt * 5));
    }
    // ویدیوی ماه فقط وقتی فصلش نزدیک است پخش می‌شود
    const nearMoon = entered && !idle && Math.abs(pos - byId.nemikaham) < 0.9 && viewer.hidden;
    if (nearMoon && moonVideo.paused) { if (moonVideo.preload !== 'auto') moonVideo.preload = 'auto'; moonVideo.play().catch(() => {}); }
    else if (!nearMoon && !moonVideo.paused) moonVideo.pause();
    // محافظ صفحه
    if (!idle && entered && !modalOpen() && now() - lastInput > 45000 && !$('iframe', screenEl)) {
      idle = true; dvd.reset(); river.override = dvd; root.classList.add('idle');
    }
    // نور صحنه
    if (STEPS[rI].kind === 'dust') {
      if (lightAuto || small() && !pdown) { lightX = innerWidth * (0.5 + 0.32 * Math.sin(t * 0.31)); lightY = innerHeight * (0.52 + 0.28 * Math.sin(t * 0.47 + 1)); }
      const v = clamp(1 - Math.abs(pos - rI) * 2.4, 0, 1);
      river.light[0] = lightX; river.light[1] = lightY; river.light[2] = Math.min(innerWidth, innerHeight) * 0.32; river.light[3] = v;
      stageDark.style.setProperty('--lx', lightX.toFixed(0) + 'px'); stageDark.style.setProperty('--ly', lightY.toFixed(0) + 'px');
    } else river.light[3] = 0;
    if (STEPS[rI].kind === 'streams' || Math.abs(pos - byId.rud) < 1) animRud(t);
    river.frame(t, dt);
    updatePanels();
    moveCursor();
    requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

  layoutAll();
  updatePanels();
  onEnter(0);
  start();
  MK.app = { go, get pos() { return pos; }, steps: STEPS, forms, enter };
})();
