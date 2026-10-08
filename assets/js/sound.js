/* ماخولا — صدا
   سه‌تارِ نشان: هر حرف دور نشان یک نت از دستگاه شور (روی سل، با رِ کُرن) است؛ صدا با روش کارپلاس‌استرانگ ساخته می‌شود.
   زیر آن صدای آرام رود و نم‌نم باران رشت. هیچ فایل صوتی بارگذاری نمی‌شود. */
(function () {
  'use strict';
  const MK = window.MK;
  // شور روی سل: سل، لا کُرن، سی بمل، دو، ر، می بمل، فا، سل، لا کُرن، سی بمل، دو (سنت)
  const CENTS = [0, 150, 300, 500, 700, 800, 1000, 1200, 1350, 1500, 1700];
  const BASE = 196;

  const S = MK.sound = { on: false, ready: false, ctx: null, notes: [] };

  function pluckBuffer(ctx, f, dur, bright) {
    const sr = ctx.sampleRate, len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, len, sr);
    // دو سیم هم‌کوک با کمی اختلاف، مثل سیم‌های جفتِ سه‌تار
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch);
      for (const det of [1, 1.0021]) {
        const N = Math.max(2, Math.round(sr / (f * det * (ch ? 1.0006 : 1))));
        const ring = new Float32Array(N);
        let p = 0;
        for (let i = 0; i < N; i++) { p += ((Math.random() * 2 - 1) - p) * bright; ring[i] = p; }
        let idx = 0;
        const decay = 0.9965 - Math.min(0.004, f / 260000);
        for (let i = 0; i < len; i++) {
          const a = ring[idx], b = ring[idx + 1 === N ? 0 : idx + 1];
          ring[idx] = (a + b) * 0.5 * decay;
          out[i] += a * 0.5;
          idx = idx + 1 === N ? 0 : idx + 1;
        }
      }
      const fi = Math.floor(sr * 0.002), fo = Math.floor(sr * 0.08);
      for (let i = 0; i < fi; i++) out[i] *= i / fi;
      for (let i = 0; i < fo; i++) out[len - 1 - i] *= i / fo;
    }
    return buf;
  }

  function impulse(ctx, sec) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  }

  function noiseBuffer(ctx, sec, brown) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w;
      }
    }
    return b;
  }

  S.init = function () {
    if (S.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (S.ctx = new AC());
    S.master = ctx.createGain(); S.master.gain.value = 0; S.master.connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    verb.connect(wet); wet.connect(S.master);
    S.dry = ctx.createGain(); S.dry.gain.value = 0.8; S.dry.connect(S.master);
    S.send = verb;
    S.tone = ctx.createBiquadFilter(); S.tone.type = 'lowpass'; S.tone.frequency.value = 3800;
    S.tone.connect(S.dry); S.tone.connect(verb);
    // نت‌ها را کم‌کم می‌سازیم تا صفحه گیر نکند
    let k = 0;
    const make = () => {
      if (k >= CENTS.length) { S.ready = true; return; }
      S.notes[k] = pluckBuffer(ctx, BASE * Math.pow(2, CENTS[k] / 1200), 3.2, 0.55);
      k++;
      setTimeout(make, 0);
    };
    make();
    // رود و باران
    const river = ctx.createBufferSource(); river.buffer = noiseBuffer(ctx, 6, true); river.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const rg = ctx.createGain(); rg.gain.value = 0.11;
    river.connect(lp); lp.connect(rg); rg.connect(S.master);
    const rain = ctx.createBufferSource(); rain.buffer = noiseBuffer(ctx, 3, false); rain.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
    const rn = ctx.createGain(); rn.gain.value = 0.011;
    rain.connect(hp); hp.connect(rn); rn.connect(S.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.04; lfo.connect(lg); lg.connect(rg.gain);
    river.start(); rain.start(); lfo.start();
    S.riverGain = rg;
  };

  S.set = function (on) {
    if (on) S.init();
    if (!S.ctx) return;
    S.on = on;
    if (on && S.ctx.state === 'suspended') S.ctx.resume();
    const g = S.master.gain, t = S.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? 0.9 : 0, t + (on ? 1.6 : 0.4));
  };

  S.pluck = function (n, vel = 0.7, when = 0) {
    if (!S.on || !S.ctx) return;
    const b = S.notes[Math.max(0, Math.min(CENTS.length - 1, n))];
    if (!b) return;
    const src = S.ctx.createBufferSource(); src.buffer = b;
    const g = S.ctx.createGain(); g.gain.value = vel * 0.55;
    src.connect(g); g.connect(S.tone);
    src.start(S.ctx.currentTime + when);
  };

  // رود پایین می‌رود؛ هر قدم یک نت پایین‌تر
  S.step = function (i) { S.pluck(10 - (i % 11), 0.22); };

  // قوقولی‌قو
  S.crow = function () { [[7, 0], [9, 0.11], [10, 0.22], [8, 0.42]].forEach(([n, w], k) => S.pluck(n, k === 3 ? 0.8 : 0.6, w)); };

  S.notesCount = CENTS.length;
})();
