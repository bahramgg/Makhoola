/* ماخولا — پیکره‌ی رود
   موتور ذره‌ها: چند هزار نقطه‌ی جوهری در WebGL که از هر فرم به فرم بعدی می‌ریزند.
   هر فرم آرایه‌ای از مقصدهاست (نشان، ماه، جلدها، خروس، رود، چهره‌ها...)؛
   همه‌ی فرم‌ها به ترتیب x (از راست به چپ) مرتب‌اند تا جابه‌جایی مثل جریان آب از راست به چپ بگذرد. */
(function () {
  'use strict';
  const MK = (window.MK = window.MK || {});

  /* ---------------- shaders ---------------- */
  const VS = `
attribute vec2 aPos; attribute vec4 aCol; attribute float aSize; attribute float aSeed;
uniform vec2 uRes; uniform float uDpr; uniform float uTime; uniform vec4 uLight; uniform float uFade;
varying vec4 vCol;
void main() {
  vec2 z = aPos / uRes * 2.0 - 1.0;
  gl_Position = vec4(z.x, -z.y, 0.0, 1.0);
  float tw = 0.78 + 0.22 * sin(uTime * (1.3 + aSeed * 2.0) + aSeed * 61.0);
  float a = aCol.a * tw;
  if (uLight.w > 0.0) {
    float d = distance(aPos, uLight.xy) / uLight.z;
    a *= mix(1.0, 1.0 + 3.2 * uLight.w, clamp(1.0 - d, 0.0, 1.0));
  }
  vCol = vec4(aCol.rgb, clamp(a * uFade, 0.0, 1.0));
  gl_PointSize = aSize * uDpr;
}`;
  const FS = `
precision mediump float; varying vec4 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = dot(d, d);
  if (r > 0.25) discard;
  gl_FragColor = vec4(vCol.rgb, vCol.a * smoothstep(0.25, 0.15, r));
}`;
  // تصویر واقعی زیر ذره‌ها با حل‌شدن دانه‌دانه ظاهر می‌شود
  const RVS = `
attribute vec2 aQ; uniform vec4 uBox; uniform vec2 uRes; varying vec2 vUv;
void main() { vUv = aQ; vec2 p = uBox.xy + aQ * uBox.zw; vec2 z = p / uRes * 2.0 - 1.0; gl_Position = vec4(z.x, -z.y, 0.0, 1.0); }`;
  const RFS = `
precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uReveal; uniform float uAlpha; uniform float uSeed;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float m = n(vUv * 7.0) * 0.6 + n(vUv * 31.0) * 0.28 + h(vUv * 900.0) * 0.12;
  float a = smoothstep(m - 0.05, m + 0.05, uReveal * 1.12 - 0.06);
  vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.0, 0.035, min(e.x, e.y));
  vec4 tx = texture2D(uTex, vUv);
  gl_FragColor = vec4(tx.rgb, tx.a * a * uAlpha * edge);
}`;

  /* ---------------- helpers ---------------- */
  function loadImg(src) {
    return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  MK.loadImg = loadImg;

  // نمونه‌برداری از بوم: نقطه‌ها روی [0,1]×[0,1] جعبه، با رنگ
  // mode: 'alpha' (شکل پر) · 'bright' (به نسبت روشنی) · 'color' (نقاشی، با رنگ خودش)
  function sample(off, n, mode, o = {}) {
    const w = off.width, h = off.height;
    const data = off.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const u = new Float32Array(n), v = new Float32Array(n), col = new Float32Array(n * 4), lum = new Float32Array(n);
    const base = o.color || [0.937, 0.89, 0.784];
    const gamma = o.gamma || 1.2, floor = o.floor == null ? 0.12 : o.floor;
    let k = 0, tries = 0;
    const max = n * 60;
    while (k < n && tries < max) {
      tries++;
      const x = Math.random() * w, y = Math.random() * h;
      const i = ((y | 0) * w + (x | 0)) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const L = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      let keep;
      if (mode === 'alpha') keep = a > 127;
      else if (mode === 'bright') keep = a > 30 && Math.random() < Math.pow(L, gamma);
      else keep = a > 30 && Math.random() < floor + (1 - floor) * Math.pow(L, 0.85);
      if (!keep) continue;
      u[k] = x / w; v[k] = y / h; lum[k] = L;
      if (mode === 'color' || o.keepColor) {
        const lift = o.lift || 1;
        col[k * 4] = Math.min(1, r / 255 * lift); col[k * 4 + 1] = Math.min(1, g / 255 * lift); col[k * 4 + 2] = Math.min(1, b / 255 * lift);
      } else { col[k * 4] = base[0]; col[k * 4 + 1] = base[1]; col[k * 4 + 2] = base[2]; }
      col[k * 4 + 3] = 1;
      k++;
    }
    // اگر تصویر خیلی تیره بود، باقی را تکرار می‌کنیم
    for (let i = k; i < n; i++) {
      const j = k ? (i % k) : 0;
      u[i] = k ? u[j] + (Math.random() - 0.5) * 0.004 : Math.random(); v[i] = k ? v[j] + (Math.random() - 0.5) * 0.004 : Math.random();
      for (let c = 0; c < 4; c++) col[i * 4 + c] = k ? col[j * 4 + c] : 0;
      lum[i] = k ? lum[j] : 0;
    }
    return { u, v, col, lum };
  }
  MK.sample = sample;

  // همه‌ی فرم‌ها به ترتیب x نزولی مرتب می‌شوند (راست به چپ)
  function sortForm(f) {
    const n = f.u.length, idx = new Uint32Array(n);
    const key = new Float32Array(n);
    for (let i = 0; i < n; i++) { idx[i] = i; key[i] = -f.u[i] * (f.aspect || 1) + (Math.random() - 0.5) * 0.02; }
    idx.sort((a, b) => key[a] - key[b]);
    const re = (src, s) => { const out = new src.constructor(src.length); for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) out[i * s + c] = src[idx[i] * s + c]; return out; };
    f.u = re(f.u, 1); f.v = re(f.v, 1); f.col = re(f.col, 4);
    if (f.size) f.size = re(f.size, 1);
    if (f.group) f.group = re(f.group, 1);
    if (f.lum) f.lum = re(f.lum, 1);
    return f;
  }
  MK.sortForm = sortForm;

  /* ---------------- engine ---------------- */
  class River {
    constructor(canvas, n) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('no-webgl');
      this.gl = gl;
      this.N = n;
      this.dpr = Math.min(window.devicePixelRatio || 1, n < 10000 ? 1.75 : 2);
      this.px = new Float32Array(n * 2); this.vel = new Float32Array(n * 2);
      this.col = new Float32Array(n * 4); this.cbuf = new Uint8Array(n * 4);
      this.size = new Float32Array(n); this.seed = new Float32Array(n); this.k = new Float32Array(n);
      this.rank = new Float32Array(n); this.base = new Float32Array(n);
      this.hi = new Float32Array(n); // درخشش موقت (برای نت‌ها)
      this.hiCol = [0.86, 0.25, 0.16];
      for (let i = 0; i < n; i++) {
        this.seed[i] = Math.random();
        this.k[i] = 0.016 + Math.random() * 0.016;
        this.rank[i] = Math.min(0.999, Math.max(0, i / n + (Math.random() - 0.5) * 0.06));
        this.base[i] = 0.9 + Math.random() * 1.7;
        this.size[i] = this.base[i];
      }
      this.forms = []; this.override = null;
      this.pos = 0; this.agit = 1;
      this.pointer = { x: -1e4, y: -1e4, r: 100, on: false, push: 1 };
      this.light = [0, 0, 1, 0];
      this.fade = 1;
      this.shocks = [];
      this.t = 0;
      this._gl();
      this.resize();
    }

    _gl() {
      const gl = this.gl;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
      this.pP = prog(VS, FS);
      this.pR = prog(RVS, RFS);
      const P = this.pP;
      this.a = { pos: gl.getAttribLocation(P, 'aPos'), col: gl.getAttribLocation(P, 'aCol'), size: gl.getAttribLocation(P, 'aSize'), seed: gl.getAttribLocation(P, 'aSeed') };
      this.u = { res: gl.getUniformLocation(P, 'uRes'), dpr: gl.getUniformLocation(P, 'uDpr'), time: gl.getUniformLocation(P, 'uTime'), light: gl.getUniformLocation(P, 'uLight'), fade: gl.getUniformLocation(P, 'uFade') };
      this.b = { pos: gl.createBuffer(), col: gl.createBuffer(), size: gl.createBuffer(), seed: gl.createBuffer(), quad: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.pos); gl.bufferData(gl.ARRAY_BUFFER, this.px.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.col); gl.bufferData(gl.ARRAY_BUFFER, this.cbuf.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.size); gl.bufferData(gl.ARRAY_BUFFER, this.size.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.seed); gl.bufferData(gl.ARRAY_BUFFER, this.seed, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      const R = this.pR;
      this.ra = { q: gl.getAttribLocation(R, 'aQ') };
      this.ru = { box: gl.getUniformLocation(R, 'uBox'), res: gl.getUniformLocation(R, 'uRes'), tex: gl.getUniformLocation(R, 'uTex'), reveal: gl.getUniformLocation(R, 'uReveal'), alpha: gl.getUniformLocation(R, 'uAlpha'), seed: gl.getUniformLocation(R, 'uSeed') };
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
    }

    resize() {
      const W = window.innerWidth, H = window.innerHeight;
      this.W = W; this.H = H;
      this.canvas.width = Math.round(W * this.dpr); this.canvas.height = Math.round(H * this.dpr);
      this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      for (const f of this.forms) if (f) this.layout(f);
      if (this.override) this.layout(this.override);
    }

    scatter() {
      const { N, W, H } = this;
      for (let i = 0; i < N; i++) { this.px[i * 2] = Math.random() * W; this.px[i * 2 + 1] = Math.random() * H; this.col[i * 4 + 3] = 0; }
    }

    // فرم ایستا: از مختصات نرمال‌شده به جعبه‌ی روی صفحه
    layout(f) {
      const n = this.N;
      if (!f.x) { f.x = new Float32Array(n); f.y = new Float32Array(n); }
      if (f.dyn) { f.dyn(this.t, f, this, true); return; }
      const b = f.box(this.W, this.H, this);
      f.b = b;
      for (let i = 0; i < n; i++) { f.x[i] = b.x + f.u[i] * b.w; f.y[i] = b.y + f.v[i] * b.h; }
    }

    prep(f) {
      if (!f.size) { f.size = new Float32Array(this.N); for (let i = 0; i < this.N; i++) f.size[i] = this.base[i] * (f.scale || 1); }
      f.reveal = f.reveal || null;
      this.layout(f);
      return f;
    }

    add(index, f) {
      this.forms[index] = f;
      return this.prep(f);
    }

    shock(x, y, s = 8, r = 220) { this.shocks.push({ x, y, s, r }); }

    texture(img) {
      const gl = this.gl, tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    frame(t, dt) {
      const k = Math.min(dt * 60, 2.2);
      this.t = t;
      const { N, px, vel, col, size, seed, rank } = this;
      const forms = this.forms, last = forms.length - 1;
      const pos = Math.max(0, Math.min(last, this.pos));
      const ia = Math.floor(pos), ib = Math.min(last, ia + 1), f = pos - ia;
      const A = this.override || forms[ia], B = this.override || forms[ib];
      if (!A || !B) return;
      if (A.dyn) A.dyn(t, A, this, false);
      if (B !== A && B.dyn) B.dyn(t, B, this, false);
      const agit = this.agit;
      const amp = 0.06 + 0.75 * agit, drift = 0.35 * agit;
      const P = this.pointer, R2 = P.r * P.r, push = P.push;
      const pOn = P.on;
      const shocks = this.shocks;
      const sl = shocks.length;
      const damp = Math.pow(0.85, k);
      const hi = this.hi;
      for (let i = 0; i < N; i++) {
        const F = rank[i] < f ? B : A;
        const ix = i * 2, iy = ix + 1;
        let x = px[ix], y = px[iy];
        if (F.jump && F.jump[i]) { x = F.x[i]; y = F.y[i]; vel[ix] = 0; vel[iy] = 0; F.jump[i] = 0; }
        const tx = F.x[i], ty = F.y[i];
        const s = seed[i];
        const kk = this.k[i] * (F.stiff || 1);
        let ax = (tx - x) * kk, ay = (ty - y) * kk;
        ax += Math.sin(y * 0.011 + t * 0.8 + s * 6.283) * amp - drift;
        ay += Math.cos(x * 0.009 - t * 0.6 + s * 3.1) * amp;
        if (pOn) {
          const dx = x - P.x, dy = y - P.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) + 0.001, q = 1 - d / P.r;
            const fpush = q * q * 3.4 * push;
            ax += (dx / d) * fpush - (dy / d) * q * 0.9;
            ay += (dy / d) * fpush + (dx / d) * q * 0.9;
          }
        }
        for (let j = 0; j < sl; j++) {
          const S = shocks[j], dx = x - S.x, dy = y - S.y, d2 = dx * dx + dy * dy;
          if (d2 < S.r * S.r) { const d = Math.sqrt(d2) + 0.001, q = 1 - d / S.r; ax += (dx / d) * q * S.s; ay += (dy / d) * q * S.s; }
        }
        let vx = vel[ix] * damp + ax * k, vy = vel[iy] * damp + ay * k;
        const v2 = vx * vx + vy * vy;
        if (v2 > 1600) { const m = 40 / Math.sqrt(v2); vx *= m; vy *= m; }
        vel[ix] = vx; vel[iy] = vy;
        px[ix] = x + vx * k; px[iy] = y + vy * k;
        // رنگ و اندازه
        const ic = i * 4, fc = F.col, lr = 0.055 * k;
        const h = hi[i];
        if (h > 0.002) {
          const hc = this.hiCol;
          col[ic] += (hc[0] - col[ic]) * 0.25; col[ic + 1] += (hc[1] - col[ic + 1]) * 0.25; col[ic + 2] += (hc[2] - col[ic + 2]) * 0.25;
          col[ic + 3] += (1 - col[ic + 3]) * 0.25;
          hi[i] = h * Math.pow(0.965, k);
        } else {
          col[ic] += (fc[ic] - col[ic]) * lr; col[ic + 1] += (fc[ic + 1] - col[ic + 1]) * lr; col[ic + 2] += (fc[ic + 2] - col[ic + 2]) * lr;
          col[ic + 3] += (fc[ic + 3] * (F.alpha == null ? 1 : F.alpha) - col[ic + 3]) * lr;
        }
        size[i] += (F.size[i] * (1 + h * 1.6) - size[i]) * 0.08 * k;
      }
      this.shocks.length = 0;
      const cb = this.cbuf;
      for (let i = 0, m = N * 4; i < m; i++) cb[i] = col[i] * 255;

      /* draw */
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      this._reveal(A, f < 0.5 ? 1 : 0);
      if (B !== A) this._reveal(B, f >= 0.5 ? 1 : 0);
      gl.useProgram(this.pP);
      gl.uniform2f(this.u.res, this.W, this.H); gl.uniform1f(this.u.dpr, this.dpr); gl.uniform1f(this.u.time, t);
      gl.uniform4f(this.u.light, this.light[0], this.light[1], this.light[2], this.light[3]);
      const rv = Math.max(A.reveal ? A.reveal.a : 0, B.reveal ? B.reveal.a : 0);
      gl.uniform1f(this.u.fade, this.fade * (1 - 0.62 * rv));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.pos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, px);
      gl.enableVertexAttribArray(this.a.pos); gl.vertexAttribPointer(this.a.pos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.col); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cb);
      gl.enableVertexAttribArray(this.a.col); gl.vertexAttribPointer(this.a.col, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.size); gl.bufferSubData(gl.ARRAY_BUFFER, 0, size);
      gl.enableVertexAttribArray(this.a.size); gl.vertexAttribPointer(this.a.size, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.seed);
      gl.enableVertexAttribArray(this.a.seed); gl.vertexAttribPointer(this.a.seed, 1, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, N);
    }

    _reveal(F, on) {
      const r = F.reveal;
      if (!r || !r.tex || r.a < 0.003 || !F.b) return;
      const gl = this.gl;
      gl.useProgram(this.pR);
      for (const k in this.a) gl.disableVertexAttribArray(this.a[k]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.b.quad);
      gl.enableVertexAttribArray(this.ra.q); gl.vertexAttribPointer(this.ra.q, 2, gl.FLOAT, false, 0, 0);
      const b = r.box ? r.box(F.b) : F.b;
      gl.uniform4f(this.ru.box, b.x, b.y, b.w, b.h);
      gl.uniform2f(this.ru.res, this.W, this.H);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.tex); gl.uniform1i(this.ru.tex, 0);
      gl.uniform1f(this.ru.reveal, r.a); gl.uniform1f(this.ru.alpha, (r.alpha || 0.92) * on * this.fade); gl.uniform1f(this.ru.seed, r.seed || 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(this.ra.q);
    }
  }
  MK.River = River;
})();
