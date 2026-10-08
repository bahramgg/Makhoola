/* ماخولا — فرم‌ها
   هر فرم می‌گوید ذره‌ها کجا بروند. فرم‌های ایستا مختصات نرمال‌شده‌ی [0,1] دارند و جعبه‌شان با اندازه‌ی صفحه عوض می‌شود؛
   فرم‌های پویا (رود، مسیر اجراها، غبار، دریا، دی‌وی‌دی) در هر فریم مقصدها را از نو می‌نویسند. */
(function () {
  'use strict';
  const MK = window.MK;
  const CREAM = [0.937, 0.89, 0.784];
  const TAU = Math.PI * 2;

  function fit(aspect, cx, cy, maxW, maxH) {
    let w = maxW, h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  MK.fit = fit;
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function blank(n) {
    return { u: new Float32Array(n), v: new Float32Array(n), col: new Float32Array(n * 4), size: new Float32Array(n) };
  }

  /* ---------------- نشان قلمدار ---------------- */
  // حلقه، خوشنویسی «ماخولا» و ۱۱ حرف کوچک دور آن؛ هر ذره می‌داند مال کدام حرف است
  MK.formEmblem = function (E, n, box) {
    const S = 0.8, W0 = 552, H0 = 702;
    const off = document.createElement('canvas');
    off.width = Math.round(W0 * S); off.height = Math.round(H0 * S);
    const ctx = off.getContext('2d', { willReadFrequently: true });
    const parts = [{ d: E.ring, g: -1 }, { d: E.main, g: 0 }].concat(E.glyphs.map((g, i) => ({ d: g.d, g: i + 1 })));
    const draw = (p) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, off.width, off.height);
      ctx.setTransform(S, 0, 0, S, -100 * S, -34 * S); ctx.fillStyle = '#fff'; ctx.fill(new Path2D(p.d), 'evenodd');
    };
    const areas = parts.map((p) => {
      draw(p);
      const d = ctx.getImageData(0, 0, off.width, off.height).data;
      let c = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 127) c++;
      return c * (p.g > 0 ? 1.9 : p.g < 0 ? 0.8 : 1);
    });
    const total = areas.reduce((a, b) => a + b, 0);
    const f = blank(n); f.group = new Int8Array(n); f.lum = new Float32Array(n);
    let k = 0;
    parts.forEach((p, pi) => {
      const cnt = pi === parts.length - 1 ? n - k : Math.round(n * areas[pi] / total);
      if (cnt <= 0) return;
      draw(p);
      const s = MK.sample(off, cnt, 'alpha', { color: CREAM });
      for (let i = 0; i < cnt && k < n; i++, k++) {
        f.u[k] = s.u[i]; f.v[k] = s.v[i];
        f.col[k * 4] = CREAM[0]; f.col[k * 4 + 1] = CREAM[1]; f.col[k * 4 + 2] = CREAM[2]; f.col[k * 4 + 3] = p.g < 0 ? 0.8 : 1;
        f.group[k] = p.g;
      }
    });
    f.aspect = W0 / H0;
    f.box = box;
    f.kind = 'emblem';
    delete f.size; // اندازه‌ها را موتور با ضریب فرم می‌سازد
    return MK.sortForm(f);
  };

  /* ---------------- تصویر (جلد، خروس، چهره) ---------------- */
  MK.formImage = async function (src, n, mode, opts, box) {
    const im = await MK.loadImg(src);
    const off = document.createElement('canvas');
    const sc = Math.min(1, 560 / Math.max(im.width, im.height));
    off.width = Math.max(1, Math.round(im.width * sc)); off.height = Math.max(1, Math.round(im.height * sc));
    off.getContext('2d').drawImage(im, 0, 0, off.width, off.height);
    const s = MK.sample(off, n, mode, opts);
    const f = { u: s.u, v: s.v, col: s.col, lum: s.lum, aspect: im.width / im.height, box, img: im };
    if (opts.sizeByLum) {
      f.size = new Float32Array(n);
      for (let i = 0; i < n; i++) f.size[i] = (opts.size || 1.4) * (0.55 + 0.9 * Math.random()) * (0.7 + 0.6 * s.lum[i]);
    }
    return MK.sortForm(f);
  };

  /* ---------------- ماهِ «نمی‌کاهم» ---------------- */
  // قرص کامل که هرگز نمی‌کاهد؛ ابرها از جلویش می‌گذرند
  function moonCanvas(S) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    const r = S / 2;
    const base = g.createRadialGradient(r * 0.86, r * 0.8, r * 0.05, r, r, r);
    base.addColorStop(0, '#fff7df'); base.addColorStop(0.65, '#efe1b4'); base.addColorStop(1, '#cdb57f');
    g.fillStyle = base; g.beginPath(); g.arc(r, r, r * 0.985, 0, TAU); g.fill();
    g.save(); g.clip();
    // دریاها (لکه‌های تیره‌ی ماه)
    g.filter = `blur(${(S * 0.02).toFixed(1)}px)`;
    g.fillStyle = 'rgba(126, 112, 82, .55)';
    [[0.34, 0.3, 0.15, 0.6], [0.52, 0.27, 0.09, 1.1], [0.6, 0.4, 0.11, 0.2], [0.73, 0.35, 0.065, 0.9], [0.27, 0.55, 0.19, 1.6],
     [0.47, 0.56, 0.08, 0.4], [0.66, 0.58, 0.075, 2.1], [0.43, 0.73, 0.09, 0.7], [0.58, 0.47, 0.05, 1.4]].forEach(([x, y, q, a]) => {
      g.beginPath(); g.ellipse(x * S, y * S, q * S, q * S * 0.72, a, 0, TAU); g.fill();
    });
    g.filter = 'none';
    // دهانه‌ها: لکه‌های نرم، نه حلقه
    g.filter = `blur(${(S * 0.004).toFixed(1)}px)`;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r * 0.9, q = S * (0.004 + Math.pow(Math.random(), 3) * 0.02);
      const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d;
      g.fillStyle = 'rgba(110, 96, 70, .22)'; g.beginPath(); g.arc(x + q * 0.2, y + q * 0.2, q, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255, 250, 232, .16)'; g.beginPath(); g.arc(x - q * 0.3, y - q * 0.3, q * 0.7, 0, TAU); g.fill();
    }
    g.filter = 'none';
    // دانه‌ی سطح
    const img = g.getImageData(0, 0, S, S), px = img.data;
    for (let i = 0; i < px.length; i += 4) { const n = (Math.random() - 0.5) * 18; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
    g.putImageData(img, 0, 0);
    // پرتوهای تیکو
    g.strokeStyle = 'rgba(255, 250, 232, .14)'; g.lineWidth = S * 0.004;
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + 0.2; g.beginPath(); g.moveTo(r * 0.92, r * 1.62); g.lineTo(r * 0.92 + Math.cos(a) * r * 0.7, r * 1.62 + Math.sin(a) * r * 0.7); g.stroke(); }
    const limb = g.createRadialGradient(r, r, r * 0.55, r, r, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(50, 36, 12, .5)');
    g.fillStyle = limb; g.fillRect(0, 0, S, S);
    g.restore();
    return c;
  }

  MK.formMoon = function (n, box) {
    const tex = moonCanvas(512);
    const nm = Math.floor(n * 0.8), nh = Math.floor(n * 0.07), nc = n - nm - nh;
    const s = MK.sample(tex, nm, 'bright', { keepColor: true, gamma: 1.6, lift: 1.05 });
    const f = blank(n);
    const isCloud = new Uint8Array(n);
    for (let k = 0; k < nm; k++) {
      f.u[k] = s.u[k]; f.v[k] = s.v[k];
      for (let c = 0; c < 4; c++) f.col[k * 4 + c] = s.col[k * 4 + c];
      f.size[k] = 1.3 + Math.random() * 1.9;
    }
    // هاله
    for (let k = nm; k < nm + nh; k++) {
      const a = Math.random() * TAU, r = 1.02 + Math.pow(Math.random(), 2.4) * 0.6;
      f.u[k] = 0.5 + Math.cos(a) * r * 0.5; f.v[k] = 0.5 + Math.sin(a) * r * 0.5;
      f.col[k * 4] = 0.95; f.col[k * 4 + 1] = 0.88; f.col[k * 4 + 2] = 0.66; f.col[k * 4 + 3] = 0.42 * (1.65 - r);
      f.size[k] = 0.8 + Math.random() * 1.2;
    }
    // ابر
    const ph = new Float32Array(n), band = new Float32Array(n), sp = new Float32Array(n);
    for (let k = nm + nh; k < n; k++) {
      isCloud[k] = 1; ph[k] = Math.random(); band[k] = 0.3 + Math.random() * 0.5; sp[k] = 0.006 + Math.random() * 0.006;
      f.u[k] = ph[k]; f.v[k] = band[k];
      f.col[k * 4] = 0.44; f.col[k * 4 + 1] = 0.52; f.col[k * 4 + 2] = 0.6; f.col[k * 4 + 3] = 0.5;
      f.size[k] = 2 + Math.random() * 3.2;
    }
    void nc;
    f.aspect = 1; f.box = box; f.kind = 'moon';
    f.reveal = { a: 0, img: tex, alpha: 0.96, seed: 3 };
    f.jump = new Uint8Array(n);
    f.dyn = (t, F, R) => {
      const b = F.box(R.W, R.H, R); F.b = b;
      const ext = b.w * 2.2, x0 = b.x + b.w / 2 + ext / 2;
      for (let i = 0; i < n; i++) {
        if (isCloud[i]) {
          const q = (ph[i] + t * sp[i]) % 1;
          F.x[i] = x0 - q * ext; F.y[i] = b.y + band[i] * b.h + Math.sin(q * 9 + i) * 6;
          F.col[i * 4 + 3] = 0.5 * smooth(0, 0.18, q) * smooth(1, 0.82, q);
          if (q < 0.004) F.jump[i] = 1;
        } else { F.x[i] = b.x + F.u[i] * b.w; F.y[i] = b.y + F.v[i] * b.h; }
      }
    };
    return f;
  };

  /* ---------------- رود: شعر نیما روی جریان ---------------- */
  MK.formStreams = function (n, lanes) {
    const f = blank(n);
    const lane = new Uint8Array(n), ph = new Float32Array(n), sp = new Float32Array(n), off = new Float32Array(n), last = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      lane[i] = Math.floor(Math.random() * lanes.length);
      ph[i] = Math.random(); sp[i] = (0.012 + Math.random() * 0.01) * lanes[lane[i]].speed;
      const g = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      off[i] = g * lanes[lane[i]].width;
      const c = lanes[lane[i]].color;
      f.col[i * 4] = c[0]; f.col[i * 4 + 1] = c[1]; f.col[i * 4 + 2] = c[2]; f.col[i * 4 + 3] = c[3];
      f.size[i] = (0.7 + Math.random() * 1.5) * (lanes[lane[i]].size || 1);
    }
    f.jump = new Uint8Array(n);
    f.dyn = (t, F, R, init) => {
      const W = R.W, H = R.H, ext = W * 1.16;
      for (let i = 0; i < n; i++) {
        const L = lanes[lane[i]];
        const q = (ph[i] + t * sp[i]) % 1;
        const x = W * 1.08 - q * ext;
        const y = H * L.y(W, H) + Math.sin(x * L.k + L.p + t * 0.35) * L.amp * H + off[i] * (1 + 0.5 * Math.sin(x * 0.004 + i));
        if (!init && q < last[i]) F.jump[i] = 1;
        last[i] = q;
        F.x[i] = x; F.y[i] = y;
        F.col[i * 4 + 3] = L.color[3] * smooth(0, 0.08, q) * smooth(1, 0.9, q);
      }
    };
    f.kind = 'streams';
    return f;
  };

  /* ---------------- از سنگ به سنگ: مسیر اجراها ---------------- */
  MK.formPath = function (n, pathFn) {
    const f = blank(n);
    const ph = new Float32Array(n), sp = new Float32Array(n), off = new Float32Array(n), last = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ph[i] = Math.random(); sp[i] = 0.004 + Math.random() * 0.006;
      off[i] = ((Math.random() + Math.random()) / 2 - 0.5);
      const gold = Math.random() < 0.18;
      f.col[i * 4] = gold ? 0.78 : 0.86; f.col[i * 4 + 1] = gold ? 0.6 : 0.82; f.col[i * 4 + 2] = gold ? 0.35 : 0.74; f.col[i * 4 + 3] = 0.55 + Math.random() * 0.4;
      f.size[i] = 0.7 + Math.random() * 1.4;
    }
    f.jump = new Uint8Array(n);
    let cache = null, cw = 0, ch = 0;
    const table = (W, H) => {
      if (cache && cw === W && ch === H) return cache;
      const M = 600, xs = new Float32Array(M + 1), ys = new Float32Array(M + 1), len = new Float32Array(M + 1);
      for (let j = 0; j <= M; j++) { const p = pathFn(j / M, W, H); xs[j] = p[0]; ys[j] = p[1]; if (j) len[j] = len[j - 1] + Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]); }
      cache = { M, xs, ys, len, total: len[M] }; cw = W; ch = H;
      return cache;
    };
    // نقطه روی مسیر بر اساس طول کمان
    const at = (T, s) => {
      const target = s * T.total; let lo = 0, hi = T.M;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T.len[mid] < target) lo = mid; else hi = mid; }
      const seg = T.len[hi] - T.len[lo] || 1, a = (target - T.len[lo]) / seg;
      const x = T.xs[lo] + (T.xs[hi] - T.xs[lo]) * a, y = T.ys[lo] + (T.ys[hi] - T.ys[lo]) * a;
      const dx = T.xs[hi] - T.xs[lo], dy = T.ys[hi] - T.ys[lo], d = Math.hypot(dx, dy) || 1;
      return [x, y, -dy / d, dx / d];
    };
    f.at = (s, W, H) => at(table(W, H), s);
    f.dyn = (t, F, R, init) => {
      const T = table(R.W, R.H), wide = Math.min(R.W, R.H) * 0.05;
      for (let i = 0; i < n; i++) {
        const q = (ph[i] + t * sp[i]) % 1;
        const p = at(T, q);
        const w = wide * (0.6 + 0.4 * Math.sin(q * 23 + 1.7));
        F.x[i] = p[0] + p[2] * off[i] * w * 2; F.y[i] = p[1] + p[3] * off[i] * w * 2;
        if (!init && q < last[i]) F.jump[i] = 1;
        last[i] = q;
      }
    };
    f.kind = 'path';
    return f;
  };

  /* ---------------- غبار صحنه (زیر نور) ---------------- */
  MK.formDust = function (n) {
    const f = blank(n);
    const bx = new Float32Array(n), by = new Float32Array(n), sp = new Float32Array(n), last = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      bx[i] = Math.random(); by[i] = Math.random(); sp[i] = 0.004 + Math.random() * 0.012;
      f.col[i * 4] = 0.95; f.col[i * 4 + 1] = 0.88; f.col[i * 4 + 2] = 0.72; f.col[i * 4 + 3] = 0.1 + Math.random() * 0.22;
      f.size[i] = 0.6 + Math.random() * 1.8;
    }
    f.jump = new Uint8Array(n);
    f.dyn = (t, F, R, init) => {
      for (let i = 0; i < n; i++) {
        const q = (by[i] + t * sp[i]) % 1;
        F.x[i] = (bx[i] + Math.sin(t * 0.2 + i) * 0.01) * R.W;
        F.y[i] = R.H * (1.04 - q * 1.08);
        if (!init && q < last[i]) F.jump[i] = 1;
        last[i] = q;
      }
    };
    f.kind = 'dust';
    return f;
  };

  /* ---------------- پرده (ویدیو) ---------------- */
  MK.formScreen = function (n, box) {
    const f = blank(n);
    for (let i = 0; i < n; i++) {
      const edge = Math.random() < 0.72;
      if (edge) {
        // قاب: ذره‌ها روی چهار ضلع، کمی پخش
        const s = Math.random() * 3.2; const j = (Math.random() - 0.5) * 0.012;
        if (s < 1) { f.u[i] = s; f.v[i] = j; } else if (s < 1.6) { f.u[i] = 1 + j; f.v[i] = (s - 1) / 0.6; }
        else if (s < 2.6) { f.u[i] = s - 1.6; f.v[i] = 1 + j; } else { f.u[i] = j; f.v[i] = (s - 2.6) / 0.6; }
        f.col[i * 4] = CREAM[0]; f.col[i * 4 + 1] = CREAM[1]; f.col[i * 4 + 2] = CREAM[2]; f.col[i * 4 + 3] = 0.85;
        f.size[i] = 0.8 + Math.random() * 1.4;
      } else {
        // خط‌های افقی ریز داخل پرده
        f.u[i] = Math.random(); f.v[i] = Math.round(Math.random() * 40) / 40;
        f.col[i * 4] = 0.6; f.col[i * 4 + 1] = 0.58; f.col[i * 4 + 2] = 0.54; f.col[i * 4 + 3] = 0.16;
        f.size[i] = 0.7 + Math.random() * 0.8;
      }
    }
    f.aspect = 16 / 9; f.box = box; f.kind = 'screen';
    return MK.sortForm(f);
  };

  /* ---------------- دهانه: رود به دریا می‌رسد ---------------- */
  // ردیف‌های موج تا افق؛ هرچه نزدیک‌تر، موج بزرگ‌تر و دانه درشت‌تر
  MK.formSea = function (n) {
    const f = blank(n);
    const ROWS = 30;
    const row = new Uint8Array(n), bx = new Float32Array(n), sp = new Float32Array(n), last = new Float32Array(n), jit = new Float32Array(n);
    const ph = new Float32Array(ROWS).map(() => Math.random() * TAU), kk = new Float32Array(ROWS).map(() => 0.004 + Math.random() * 0.006);
    for (let i = 0; i < n; i++) {
      const r = Math.min(ROWS - 1, Math.floor(Math.pow(Math.random(), 0.75) * ROWS));
      row[i] = r; bx[i] = Math.random(); jit[i] = (Math.random() - 0.5);
      const d = (r + 1) / ROWS;
      sp[i] = 0.002 + d * 0.006;
      const L = r === 0 ? 1 : 0.5 + 0.5 * (1 - d * 0.6);
      f.col[i * 4] = 0.93 * L; f.col[i * 4 + 1] = 0.89 * L; f.col[i * 4 + 2] = 0.8 * L; f.col[i * 4 + 3] = r === 0 ? 0.95 : 0.35 + 0.5 * d;
      f.size[i] = r === 0 ? 1.2 : 0.7 + d * 2.6 + Math.random() * 0.5;
    }
    f.jump = new Uint8Array(n);
    f.dyn = (t, F, R, init) => {
      const W = R.W, H = R.H, hz = H * (W < 760 ? 0.72 : 0.68);
      for (let i = 0; i < n; i++) {
        const r = row[i], d = (r + 1) / ROWS;
        const q = (bx[i] + t * sp[i]) % 1;
        const x = W * 1.04 - q * W * 1.08;
        const amp = 1 + d * d * 16;
        const y = hz + (H - hz) * Math.pow(r / ROWS, 1.5) + Math.sin(x * kk[r] + t * (0.6 + d) + ph[r]) * amp + Math.sin(x * kk[r] * 2.7 - t * 0.9) * amp * 0.35 + jit[i] * d * 3;
        F.x[i] = x; F.y[i] = y;
        if (!init && q < last[i]) F.jump[i] = 1;
        last[i] = q;
      }
    };
    f.kind = 'sea';
    return f;
  };

  /* ---------------- حلقه‌ی ورود ---------------- */
  MK.formRing = function (n) {
    const f = blank(n);
    const a0 = new Float32Array(n), rr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      a0[i] = Math.random() * TAU; rr[i] = 1 + ((Math.random() + Math.random()) / 2 - 0.5) * 0.05;
      f.col[i * 4] = CREAM[0]; f.col[i * 4 + 1] = CREAM[1]; f.col[i * 4 + 2] = CREAM[2]; f.col[i * 4 + 3] = 0.55 + Math.random() * 0.45;
      f.size[i] = 0.7 + Math.random() * 1.3;
    }
    f.dyn = (t, F, R) => {
      const r = Math.min(R.W, R.H) * 0.3, cx = R.W / 2, cy = R.H / 2;
      for (let i = 0; i < n; i++) {
        const a = a0[i] + t * 0.05 * (i % 2 ? 1 : 0.7);
        F.x[i] = cx + Math.cos(a) * r * rr[i]; F.y[i] = cy + Math.sin(a) * r * rr[i];
      }
    };
    f.kind = 'ring';
    return f;
  };

  /* ---------------- محافظ صفحه: نشان مثل لوگوی دی‌وی‌دی می‌چرخد ---------------- */
  MK.formDVD = function (emblem, palette, onBounce) {
    const n = emblem.u.length;
    const f = { u: emblem.u, v: emblem.v, col: new Float32Array(emblem.col), size: emblem.size, aspect: emblem.aspect, kind: 'dvd', stiff: 2.2 };
    let x = -1, y = -1, vx = 1.6, vy = 1.2, ci = 0;
    const paint = () => { const c = palette[ci % palette.length]; for (let i = 0; i < n; i++) { f.col[i * 4] = c[0]; f.col[i * 4 + 1] = c[1]; f.col[i * 4 + 2] = c[2]; f.col[i * 4 + 3] = 1; } };
    paint();
    let lt = 0;
    f.dyn = (t, F, R) => {
      const h = Math.min(R.H * 0.24, 180), w = h * emblem.aspect;
      if (x < 0) { x = Math.random() * (R.W - w); y = Math.random() * (R.H - h); lt = t; }
      const dt = Math.min(0.05, t - lt) * 60; lt = t;
      x += vx * dt; y += vy * dt;
      let hit = false;
      if (x < 0) { x = 0; vx = Math.abs(vx); hit = true; } else if (x + w > R.W) { x = R.W - w; vx = -Math.abs(vx); hit = true; }
      if (y < 0) { y = 0; vy = Math.abs(vy); hit = true; } else if (y + h > R.H) { y = R.H - h; vy = -Math.abs(vy); hit = true; }
      if (hit) { ci++; paint(); if (onBounce) onBounce(); }
      F.b = { x, y, w, h };
      for (let i = 0; i < n; i++) { F.x[i] = x + F.u[i] * w; F.y[i] = y + F.v[i] * h; }
    };
    f.reset = () => { x = -1; };
    return f;
  };
})();
