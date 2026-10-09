// ماخولا — شب‌هنگام، پشت پنجره
//
// The page is one window on a rainy night. Rain runs down the outside of the glass,
// the inside is fogged, and a finger writes on it. Writing leaves grease on the glass,
// so when the fog comes back the words stay as ghosts, and breathing on the glass
// brings out older writing. The forest outside is footage from the «نمی‌کاهم» teaser.

const root = document.documentElement;
const canvas = document.getElementById('glass');
const outside = document.getElementById('outside');
const teaser = document.getElementById('teaser');
const playBtn = document.getElementById('play');
const soundBtn = document.getElementById('sound');
const handleLink = document.getElementById('handle');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
});

/* ------------------------------------------------------------------ shaders */

const FULL_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Glass state: r = condensation, g = breath, b = wet film, a = grease (memory).
// Grease above 0.4 is permanent; fainter grease from the visitor's own finger fades.
const UPDATE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uPrev, uNoise;
uniform float uDt, uRegrow, uBreathK, uDryK, uMemK, uFrame, uDither, uAspect;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  vec4 f = texture(uPrev, vUv);
  vec2 q = vUv * vec2(uAspect, 1.0);
  float n = texture(uNoise, q * 0.8).r;
  float n2 = texture(uNoise, q * 2.7 + 0.37).a;
  float edge = min(min(vUv.x, 1.0 - vUv.x) * uAspect, min(vUv.y, 1.0 - vUv.y));
  float rate = uRegrow * (0.3 + 2.6 * n * n2) * (1.0 + 1.6 * smoothstep(0.2, 0.0, edge));
  float F = f.r + (1.0 - f.r) * (1.0 - exp(-rate * uDt));
  float B = f.g * exp(-uBreathK * uDt);
  float W = f.b * exp(-uDryK * uDt);
  bool fading = f.a < 0.395;
  float M = fading ? max(0.0, f.a - uMemK * uDt) : f.a;
  vec4 v = clamp(vec4(F, B, W, M), 0.0, 1.0);
  if (uDither > 0.5) {
    vec2 c = gl_FragCoord.xy + uFrame * vec2(17.0, 31.0);
    v.r += (hash(c) - 0.5) / 255.0;
    v.g += (hash(c + 11.0) - 0.5) / 255.0;
    v.b += (hash(c + 23.0) - 0.5) / 255.0;
    if (fading) v.a += (hash(c + 37.0) - 0.5) / 255.0;
  }
  o = v;
}`;

// A capsule (finger segment, breath blob or droplet eraser), positions in CSS pixels.
const STAMP_VS = `#version 300 es
layout(location = 0) in vec4 aSeg;
layout(location = 1) in vec4 aRad;
layout(location = 2) in vec4 aVal;
uniform vec2 uView;
out vec2 vPos;
flat out vec4 vSeg;
flat out vec4 vRad;
flat out vec4 vVal;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 d = aSeg.zw - aSeg.xy;
  float L = length(d);
  vec2 dir = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float R = max(aRad.x, aRad.y) + aRad.z * 2.0 + 1.0;
  vec2 pos = (c.x < 0.0 ? aSeg.xy - dir * R : aSeg.zw + dir * R) + nrm * c.y * R;
  vPos = pos;
  vSeg = aSeg;
  vRad = aRad;
  vVal = aVal;
  gl_Position = vec4(pos.x / uView.x * 2.0 - 1.0, 1.0 - pos.y / uView.y * 2.0, 0.0, 1.0);
}`;

const STAMP_FS = `#version 300 es
precision highp float;
in vec2 vPos;
flat in vec4 vSeg;
flat in vec4 vRad;
flat in vec4 vVal;
uniform int uMode;
uniform sampler2D uNoise;
out vec4 o;
void main() {
  vec2 p0 = vSeg.xy, d = vSeg.zw - vSeg.xy;
  float L2 = dot(d, d);
  float t = L2 > 1e-6 ? clamp(dot(vPos - p0, d) / L2, 0.0, 1.0) : 0.0;
  float dist = length(vPos - (p0 + d * t));
  float r = mix(vRad.x, vRad.y, t);
  float s = vRad.w;
  if (uMode == 2) {                                                  // ADD: breath, a soft lumpy cloud
    float lumps = texture(uNoise, vPos / (r * 2.4) + vVal.z).r;
    float k = clamp(1.0 - dist / (r * (0.6 + 0.8 * lumps)), 0.0, 1.0);
    o = vec4(0.0, k * k * (3.0 - 2.0 * k) * s, 0.0, 0.0);
    return;
  }
  float n = texture(uNoise, vPos / 70.0 + vVal.z).a - 0.5;
  dist += n * vRad.z * 1.8;
  float cov = 1.0 - smoothstep(r - vRad.z, r + vRad.z, dist);
  if (uMode == 0) o = vec4(vec2(1.0 - cov * s), 1.0, 1.0);        // MIN: wipe condensation and breath
  else if (uMode == 1) o = vec4(0.0, 0.0, cov * vVal.x, cov * vVal.y); // MAX: wet film, grease
  else o = vec4(0.0, 0.0, 0.0, cov * s);                            // erase droplets
}`;

// A water drop: premultiplied (normal.xy, height, coverage). Normal y points down the page.
const DROP_VS = `#version 300 es
layout(location = 0) in vec4 aDrop;
layout(location = 1) in vec4 aDrop2;
uniform vec2 uView;
out vec2 vP;
flat out float vA;
flat out float vSeed;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 rad = aDrop.z * vec2(1.0 + aDrop2.x, (1.0 + aDrop2.y) * aDrop.w);
  vec2 pos = aDrop.xy + c * rad * 1.04;
  vP = c * 1.04;
  vA = aDrop2.z;
  vSeed = aDrop2.w;
  gl_Position = vec4(pos.x / uView.x * 2.0 - 1.0, 1.0 - pos.y / uView.y * 2.0, 0.0, 1.0);
}`;

const DROP_FS = `#version 300 es
precision highp float;
in vec2 vP;
flat in float vA;
flat in float vSeed;
out vec4 o;
void main() {
  vec2 p = vP;
  p.x *= 1.0 + 0.18 * clamp(-p.y, 0.0, 1.0);
  float wob = 0.04 * sin(atan(p.y, p.x) * 3.0 + vSeed * 6.2832);
  float d = length(p) * (1.0 + wob);
  if (d >= 1.0) discard;
  float h = sqrt(1.0 - d * d);
  float a = smoothstep(1.0, 0.8, d) * vA;
  o = vec4((clamp(p, -1.0, 1.0) * 0.5 + 0.5) * a, h * a, a);
}`;

const COPY_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
void main() { o = texture(uTex, vUv); }`;

// An image (the emblem) pressed into the grease channel.
const MASK_VS = `#version 300 es
uniform vec4 uRect;
uniform float uAngle;
uniform vec2 uView;
out vec2 vUv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vUv = c;
  vec2 l = (c - 0.5) * uRect.zw;
  float s = sin(uAngle), k = cos(uAngle);
  vec2 p = uRect.xy + vec2(k * l.x - s * l.y, s * l.x + k * l.y);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;

const MASK_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform float uMem;
void main() { o = vec4(0.0, 0.0, 0.0, texture(uTex, vUv).a * uMem); }`;

// Calligraphy written into the fog. R = glyph coverage, G = when the reed reaches the pixel.
// uKind 1 draws the play mark (a rounded triangle) instead of a mask.
const GLYPH_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform int uMode, uKind;
uniform float uTau, uSoft, uMem, uWet;
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
void main() {
  float cov, t;
  if (uKind == 1) {
    vec2 p = vUv * 2.0 - 1.0;
    float d = sdTri(p, vec2(-0.6, -0.78), vec2(-0.6, 0.78), vec2(0.78, 0.0)) - 0.08;
    cov = 1.0 - smoothstep(-0.035, 0.035, d);
    t = vUv.x;
  } else {
    vec2 g = texture(uTex, vUv).rg;
    cov = g.r;
    t = g.g;
  }
  float c = cov * smoothstep(t, t + uSoft, uTau);
  if (uMode == 0) o = vec4(vec2(1.0 - c), 1.0, 1.0);
  else o = vec4(0.0, 0.0, c * uWet, c * uMem);
}`;

const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uRain, uDrip, uFog, uNoise;
uniform vec2 uView, uSceneScale, uSceneOffset, uLamp, uSceneTexel;
uniform vec4 uLights[3];
uniform vec3 uCursor;
uniform float uTime, uFlash, uExpo, uSceneMix, uTeaser, uSceneAspect;

// distant lights in the forest, blurred like the footage at the same level
vec3 lights(vec2 s, float lod) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 l = uLights[i];
    float r = max(l.z, 1e-4) * (1.0 + exp2(lod) * 0.7);
    vec2 d = (s - l.xy) * vec2(uSceneAspect, 1.0);
    acc += exp(-dot(d, d) / (r * r)) * pow(l.z / r, 0.75) * l.w;
  }
  return acc * vec3(1.0, 0.6, 0.27) * (1.0 - uTeaser);
}
vec3 sceneRaw(vec2 uv, float lod) {
  vec2 s = uv * uSceneScale + uSceneOffset;
  vec3 c = textureLod(uScene, s, lod).rgb;
  vec3 g = mix(vec3(0.006, 0.009, 0.014), vec3(0.03, 0.045, 0.06), smoothstep(0.1, 0.95, uv.y));
  return mix(g, c, uSceneMix);
}
vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 night = mix(vec3(l), c, 0.42) * vec3(0.72, 0.86, 1.0) * 0.8;
  night = pow(night, vec3(2.2)) * 1.05;
  return mix(night, c, uTeaser);
}
vec3 outside(vec2 uv, float lod) {
  return grade(sceneRaw(uv, lod)) + lights(uv * uSceneScale + uSceneOffset, lod);
}
vec3 outsideSoft(vec2 uv, float lod) {
  vec2 o = exp2(lod) * uSceneTexel * 0.8;
  vec3 c = outside(uv, lod) * 0.36;
  c += outside(uv + vec2(o.x, o.y), lod) * 0.16;
  c += outside(uv + vec2(-o.x, o.y), lod) * 0.16;
  c += outside(uv + vec2(o.x, -o.y), lod) * 0.16;
  c += outside(uv + vec2(-o.x, -o.y), lod) * 0.16;
  return c;
}
void main() {
  vec2 uv = vUv;
  vec2 px = vec2(uv.x, 1.0 - uv.y) * uView;
  vec4 F = texture(uFog, uv);
  float M = F.a;
  float greasy = smoothstep(0.17, 0.4, M);
  // breath on greasy glass forms a clear film, so old writing shows up dark inside the cloud
  float fog = F.r * (1.0 - 0.92 * smoothstep(0.55, 1.0, M)) * (1.0 - 0.8 * greasy * clamp(F.g * 1.6, 0.0, 1.0));
  float breath = clamp(F.g * (1.0 - 0.96 * greasy), 0.0, 1.0);
  float dens = clamp(fog + breath, 0.0, 1.0);
  float nLow = texture(uNoise, px / 1100.0).r;
  float nMid = texture(uNoise, px / 280.0 + 0.31).a;
  vec2 pa = mat2(0.93, 0.37, -0.37, 0.93) * px;
  vec2 pb = mat2(0.62, -0.78, 0.78, 0.62) * px;
  float beads = max(texture(uNoise, pa / 141.0).g, texture(uNoise, pb / 89.0 + 0.5).g * 0.8) * (0.55 + 0.9 * nMid);
  dens = clamp(dens * (0.84 + 0.22 * nLow + 0.1 * nMid), 0.0, 1.0);
  dens = clamp(dens + (beads - 0.4) * 4.0 * dens * (1.0 - dens) * 0.5, 0.0, 1.0);
  float d2 = dens * dens;
  vec3 L = normalize(vec3(-0.35, 0.6, 0.72));
  vec3 warm = vec3(1.0, 0.66, 0.38);
  vec2 lp = (px - uLamp) / uView.y;
  float lamp = exp(-dot(lp, lp) * 3.2);
  float flick = 0.93 + 0.07 * sin(uTime * 6.1) * sin(uTime * 2.3 + 1.7);

  // the outer surface: rain, seen through the condensation
  vec4 r = textureLod(uRain, uv, d2 * 3.0);
  vec2 n = (r.rg - 0.5) * 2.0;
  vec2 nUv = vec2(n.x, -n.y);
  float h = r.b, a = clamp(r.a, 0.0, 1.0);
  vec2 wet = (texture(uNoise, px / vec2(26.0, 160.0)).ra - 0.5) * F.b * 5.0;
  vec2 refr = (-nUv * (14.0 + 40.0 * h) * a + wet) / uView;
  vec3 col = outside(uv + refr, mix(1.1, 0.1, a) + d2 * 5.0);
  col *= 1.0 - 0.55 * a * smoothstep(0.6, 0.0, h);
  vec3 N = normalize(vec3(nUv * 1.5, max(h, 0.04)));
  col += pow(max(dot(N, L), 0.0), 22.0) * a * vec3(0.5, 0.58, 0.68) * 0.3 * (1.0 - d2 * 0.85);
  col += F.b * (texture(uNoise, px / vec2(34.0, 320.0)).a - 0.5) * 0.05;

  // the inner surface: condensation, lit by the room and by the night behind it
  vec3 glow = outsideSoft(uv, 4.7);
  float gl = dot(glow, vec3(0.3, 0.59, 0.11));
  vec3 room = vec3(0.074, 0.081, 0.09) * (0.75 + 0.5 * nLow);
  vec3 fogCol = room + mix(glow, vec3(gl), 0.3) * 1.38;
  fogCol += warm * lamp * (0.15 + 0.16 * beads * beads * beads) * flick;
  fogCol *= 0.97 + 0.06 * beads * (1.0 - 0.6 * breath);
  // fresh breath is denser and whiter than the old condensation
  fogCol = fogCol * (1.0 + 0.6 * breath) + vec3(0.07, 0.075, 0.08) * breath;
  float ridge = clamp(fwidth(fog) * 10.0, 0.0, 1.0) * (1.0 - fog);
  col = mix(col, fogCol, smoothstep(0.0, 1.0, dens) * 0.93);
  col += ridge * (vec3(0.03, 0.034, 0.04) + glow * 0.3 + warm * lamp * 0.12);
  col += warm * lamp * 0.022 * flick;

  // drips on the inside, in front of the condensation
  vec4 dr = texture(uDrip, uv);
  float da = clamp(dr.a, 0.0, 1.0);
  if (da > 0.003) {
    vec2 dn = (dr.rg - 0.5) * 2.0;
    vec2 dnUv = vec2(dn.x, -dn.y);
    vec3 dc = outside(uv - dnUv * (8.0 + 24.0 * dr.b) / uView, 0.4);
    dc *= 1.0 - 0.6 * smoothstep(0.55, 0.0, dr.b);
    vec3 DN = normalize(vec3(dnUv * 1.6, max(dr.b, 0.04)));
    dc += pow(max(dot(DN, L), 0.0), 26.0) * vec3(0.7, 0.75, 0.8) * 0.5;
    vec3 Lw = normalize(vec3((uLamp - px) / uView.y, 0.45));
    dc += warm * pow(max(dot(DN, Lw), 0.0), 12.0) * (0.12 + 0.5 * lamp);
    col = mix(col, dc, da);
  }

  // lightning lights the night and the fog
  col += uFlash * (glow * 2.4 + vec3(0.045, 0.055, 0.08) * (0.4 + dens));

  // fingertip
  float cd = length(px - uCursor.xy);
  col += vec3(0.82, 0.86, 0.9) * uCursor.z * 0.07 * smoothstep(1.4, 0.0, abs(cd - 6.5));

  vec2 q = (uv - 0.5) * vec2(1.0, 1.2);
  col *= 1.0 - 0.8 * dot(q, q);
  float grain = texture(uNoise, px / 256.0 + fract(uTime * vec2(0.137, 0.271)) * 9.0).b;
  col += (grain - 0.5) * 0.018;
  outColor = vec4(max(col * uExpo, 0.0), 1.0);
}`;

/* ---------------------------------------------------------------- helpers */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const chance = (p) => Math.random() < p;
const smooth = (t) => t * t * (3 - 2 * t);

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 256² tileable noise: r, a = value-noise fbm, g = condensation beads, b = white noise.
function makeNoise(size = 256) {
  const rnd = mulberry32(7);
  const fbm = (periods, seed) => {
    const out = new Float32Array(size * size);
    let amp = 0.5;
    let total = 0;
    periods.forEach((P, o) => {
      const r = mulberry32(seed + o * 101);
      const g = new Float32Array(P * P).map(() => r());
      const cell = size / P;
      for (let y = 0; y < size; y++) {
        const fy = y / cell;
        const y0 = Math.floor(fy);
        const sy = smooth(fy - y0);
        const ya = (y0 % P) * P;
        const yb = ((y0 + 1) % P) * P;
        for (let x = 0; x < size; x++) {
          const fx = x / cell;
          const x0 = Math.floor(fx);
          const sx = smooth(fx - x0);
          const xa = x0 % P;
          const xb = (x0 + 1) % P;
          const top = g[ya + xa] + (g[ya + xb] - g[ya + xa]) * sx;
          const bot = g[yb + xa] + (g[yb + xb] - g[yb + xa]) * sx;
          out[y * size + x] += amp * (top + (bot - top) * sy);
        }
      }
      total += amp;
      amp *= 0.5;
    });
    return out.map((v) => v / total);
  };
  const r = fbm([4, 8, 16, 32], 11);
  const a = fbm([2, 4, 8, 16, 64], 23);
  const g = new Float32Array(size * size);
  for (let cy = 0; cy < size / 8; cy++) {
    for (let cx = 0; cx < size / 8; cx++) {
      const rr = 1 + rnd() * 2.6;
      const ox = cx * 8 + 4 + (rnd() - 0.5) * 4;
      const oy = cy * 8 + 4 + (rnd() - 0.5) * 4;
      for (let y = Math.floor(oy - rr - 1); y <= oy + rr + 1; y++) {
        for (let x = Math.floor(ox - rr - 1); x <= ox + rr + 1; x++) {
          const d = Math.hypot(x - ox, y - oy) / rr;
          if (d >= 1) continue;
          const i = (((y % size) + size) % size) * size + (((x % size) + size) % size);
          g[i] = Math.max(g[i], Math.sqrt(1 - d * d));
        }
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = r[i] * 255;
    data[i * 4 + 1] = g[i] * 255;
    data[i * 4 + 2] = rnd() * 255;
    data[i * 4 + 3] = a[i] * 255;
  }
  return data;
}

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(vs, fs, samplers = {}) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(p, i).name;
    u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name);
  }
  gl.useProgram(p);
  for (const [name, unit] of Object.entries(samplers)) if (u[name]) gl.uniform1i(u[name], unit);
  return { p, u };
}

function texture(w, h, internal, format, type, { filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, mip = false, data = null } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}

function target(w, h, fmt, mip = false) {
  const tex = texture(w, h, fmt.internal, fmt.format, fmt.type, { mip });
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h, ok };
}

function dropTarget(t) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

// A buffer of per-instance floats drawn as quads (triangle strip of 4).
function instances(per, max, layout) {
  const data = new Float32Array(per * max);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  let off = 0;
  layout.forEach((size, loc) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, per * 4, off * 4);
    gl.vertexAttribDivisor(loc, 1);
    off += size;
  });
  gl.bindVertexArray(null);
  return { data, buf, vao, per, max, n: 0, sent: false };
}

function drawInstances(b) {
  if (!b.n) return;
  if (!b.sent) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.data, 0, b.n * b.per);
    b.sent = true;
  }
  gl.bindVertexArray(b.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.n);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ------------------------------------------------------------------- main */

async function start() {
  const half = gl.getExtension('EXT_color_buffer_float')
    ? { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }
    : null;
  const byte = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };

  const P = {
    update: program(FULL_VS, UPDATE_FS, { uPrev: 0, uNoise: 1 }),
    stamp: program(STAMP_VS, STAMP_FS, { uNoise: 1 }),
    drop: program(DROP_VS, DROP_FS),
    copy: program(FULL_VS, COPY_FS, { uTex: 0 }),
    mask: program(MASK_VS, MASK_FS, { uTex: 0 }),
    glyph: program(MASK_VS, GLYPH_FS, { uTex: 0 }),
    comp: program(FULL_VS, COMP_FS, { uScene: 0, uNoise: 1, uRain: 2, uDrip: 3, uFog: 4 }),
  };
  const empty = gl.createVertexArray();

  gl.activeTexture(gl.TEXTURE1);
  const noiseTex = texture(256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, {
    wrap: gl.REPEAT,
    mip: true,
    data: makeNoise(),
  });
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(gl.TEXTURE0);
  const sceneTex = texture(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { mip: true, data: new Uint8Array([2, 3, 5, 255]) });
  gl.generateMipmap(gl.TEXTURE_2D);

  const B = {
    wipes: instances(12, 2048, [4, 4, 4]),
    marks: instances(12, 4096, [4, 4, 4]),
    breaths: instances(12, 64, [4, 4, 4]),
    erasers: instances(12, 3072, [4, 4, 4]),
    drops: instances(8, 3072, [4, 4]),
    droplets: instances(8, 4096, [4, 4]),
    drips: instances(8, 512, [4, 4]),
  };

  function stamp(b, x0, y0, x1, y1, r0, r1, feather, strength, wet = 0, mem = 0) {
    if (b.n >= b.max) return;
    const d = b.data;
    const o = b.n++ * 12;
    d[o] = x0;
    d[o + 1] = y0;
    d[o + 2] = x1;
    d[o + 3] = y1;
    d[o + 4] = r0;
    d[o + 5] = r1;
    d[o + 6] = feather;
    d[o + 7] = strength;
    d[o + 8] = wet;
    d[o + 9] = mem;
    d[o + 10] = Math.random();
    d[o + 11] = 0;
    b.sent = false;
  }

  function drop(b, x, y, r, stretch, sx, sy, alpha, seed) {
    if (b.n >= b.max) return;
    const d = b.data;
    const o = b.n++ * 8;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = r;
    d[o + 3] = stretch;
    d[o + 4] = sx;
    d[o + 5] = sy;
    d[o + 6] = alpha;
    d[o + 7] = seed;
    b.sent = false;
  }

  /* -------------------------------------------------------------- size */

  let W = 0;
  let H = 0;
  let dpr = 1;
  let fogFmt = half || byte;
  let fogA, fogB, dropletsT, rainT, dripT;
  let pixelBudget = 3.2e6;

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(pixelBudget / (W * H)));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function buildTargets() {
    [fogA, fogB, dropletsT, rainT, dripT].forEach(dropTarget);
    const fs = clamp(1150 / Math.max(W, H), 0.5, 1);
    const fw = Math.round(W * fs);
    const fh = Math.round(H * fs);
    fogA = target(fw, fh, fogFmt);
    fogB = target(fw, fh, fogFmt);
    if (!fogA.ok || !fogB.ok) {
      dropTarget(fogA);
      dropTarget(fogB);
      fogFmt = byte;
      fogA = target(fw, fh, fogFmt);
      fogB = target(fw, fh, fogFmt);
    }
    const rs = clamp(1000 / Math.max(W, H), 0.45, 1);
    const rw = Math.round(W * rs);
    const rh = Math.round(H * rs);
    dropletsT = target(rw, rh, byte);
    rainT = target(rw, rh, byte, true);
    dripT = target(rw, rh, byte);
    clearTarget(fogA, 0, 0, 0, 0);
    clearTarget(fogB, 0, 0, 0, 0);
    clearTarget(dropletsT, 0, 0, 0, 0);
  }

  function clearTarget(t, r, g, b, a) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /* ------------------------------------------------------------ outside */

  let sceneW = 1280;
  let sceneH = 720;
  let sceneMix = 0;
  let sceneMixTarget = 0;
  let source = null; // the video currently uploaded each frame
  let freshFrame = false;
  let lastVideoTime = -1;

  function uploadScene(src) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  function watchFrames(video) {
    if (!video.requestVideoFrameCallback) return;
    const on = () => {
      freshFrame = true;
      video.requestVideoFrameCallback(on);
    };
    video.requestVideoFrameCallback(on);
  }

  function pumpScene() {
    const v = source;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    if (!freshFrame && v.currentTime === lastVideoTime) return;
    freshFrame = false;
    lastVideoTime = v.currentTime;
    try {
      uploadScene(v);
      sceneW = v.videoWidth;
      sceneH = v.videoHeight;
      sceneMixTarget = 1;
    } catch (err) {
      source = null;
    }
  }

  loadImage(outside.getAttribute('poster'))
    .then((img) => {
      if (source && sceneMixTarget) return;
      uploadScene(img);
      sceneW = img.naturalWidth;
      sceneH = img.naturalHeight;
      sceneMixTarget = 1;
    })
    .catch(() => {});

  watchFrames(outside);
  watchFrames(teaser);
  source = outside;
  if (reduceMotion) {
    outside.removeAttribute('autoplay');
    outside.pause();
  } else {
    outside.play().catch(() => {});
  }

  /* --------------------------------------------------------------- data */

  let glass = null; // calligraphy masks: aspect, margin, length, drip points
  const glassTex = {};
  const emblemImg = loadImage('assets/img/brand/emblem.svg').catch(() => null);

  /* ------------------------------------------------------------- layout */

  const EMBLEM_A = 552 / 702;
  let L = {};
  let portrait = false;

  function layout() {
    portrait = H > W * 1.05;
    const a = (k) => glass[k].a;
    const u = Math.min(W, H);
    L = {};
    if (portrait) {
      const eh = Math.min(H * 0.4, (W * 0.78) / EMBLEM_A);
      L.emblem = { cx: W * 0.5, cy: H * 0.34, h: eh };
      const ah = clamp(H * 0.085, 54, 90);
      L.album = { cx: W * 0.58, cy: L.emblem.cy + eh * 0.5 + ah * 0.95, h: ah, angle: 0.03 };
      L.hidden = { cx: W * 0.5, cy: H * 0.78, h: Math.min(40, (W * 0.8) / a('v4')), angle: -0.03 };
      L.breathe = { cx: W * 0.5, cy: H * 0.86, h: 44, angle: 0.02 };
    } else {
      const eh = Math.min(H * 0.66, (W * 0.42) / EMBLEM_A);
      L.emblem = { cx: W * 0.6, cy: H * 0.46, h: eh };
      const ah = clamp(H * 0.25, 100, 260);
      const aw = ah * a('album');
      L.album = { cx: Math.max(aw / 2 + W * 0.05, L.emblem.cx - (eh * EMBLEM_A) / 2 - aw / 2 - W * 0.035), cy: L.emblem.cy + eh * 0.16, h: ah, angle: 0.02 };
      const hh = Math.max(44, H * 0.07);
      L.hidden = { cx: W * 0.27, cy: H * 0.2, h: hh, angle: -0.03 };
      L.breathe = { cx: W * 0.27, cy: H * 0.2 + hh * 0.5 + 54, h: Math.max(48, H * 0.065), angle: 0.03 };
    }
    const albumW = L.album.h * a('album');
    L.play = portrait
      ? { cx: L.album.cx - albumW / 2 - L.album.h * 0.62, cy: L.album.cy + L.album.h * 0.06, h: L.album.h * 0.44, angle: 0 }
      : { cx: L.album.cx + albumW * 0.12, cy: L.album.cy + L.album.h * 0.82, h: L.album.h * 0.24, angle: 0 };
    const ui = clamp(u * 0.03, 16, 24);
    L.handle = { cx: 18 + (ui * a('handle')) / 2, cy: H - 18 - ui / 2, h: ui, angle: 0 };
    const sh = ui * 1.7;
    L.sound = { cx: W - 18 - (sh * a('sound')) / 2, cy: H - 16 - sh / 2, h: sh, angle: 0 };
    L.lamp = portrait ? [W * 0.86, H * 0.1] : [W * 0.82, H * 0.2];
    const ew = L.emblem.h * EMBLEM_A;
    L.emblemRect = { x0: L.emblem.cx - ew / 2, y0: L.emblem.cy - L.emblem.h / 2, x1: L.emblem.cx + ew / 2, y1: L.emblem.cy + L.emblem.h / 2 };
  }

  function rectOf(place, a) {
    const w = place.h * a;
    return { x0: place.cx - w / 2, y0: place.cy - place.h / 2, x1: place.cx + w / 2, y1: place.cy + place.h / 2 };
  }

  const overlaps = (p, q, pad = 0) => p.x0 - pad < q.x1 && q.x0 - pad < p.x1 && p.y0 - pad < q.y1 && q.y0 - pad < p.y1;

  function placeHit(el, box, pad) {
    el.style.left = `${box.x0 - pad}px`;
    el.style.top = `${box.y0 - pad}px`;
    el.style.width = `${box.x1 - box.x0 + pad * 2}px`;
    el.style.height = `${box.y1 - box.y0 + pad * 2}px`;
  }

  /* ------------------------------------------------------------- writer */

  const queue = [];
  let job = null;
  const written = []; // rects of visible writing, newest last

  function sleeve(rect, rows) {
    const pts = [];
    const rowH = (rect.y1 - rect.y0) / rows;
    for (let i = 0; i < rows; i++) {
      const y = rect.y0 + rowH * (i + 0.5);
      const rtl = i % 2 === 0;
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        const x = rtl ? rect.x1 - (rect.x1 - rect.x0) * t : rect.x0 + (rect.x1 - rect.x0) * t;
        pts.push([x, y + Math.sin(t * Math.PI * 2 + i) * rowH * 0.18, 1]);
      }
    }
    return pts;
  }

  function radius(j, w) {
    return j.R * (0.8 + 0.2 * clamp(w / j.wMed, 0.5, 1.9));
  }

  function pointAt(op, s) {
    const { cum, pts } = op;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const t = clamp((s - cum[lo]) / span, 0, 1);
    const a = pts[lo];
    const b = pts[hi];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, lo];
  }

  function finger(j, a, b) {
    const fe = Math.max(1, j.R * 0.16);
    stamp(B.wipes, a[0], a[1], b[0], b[1], radius(j, a[2]), radius(j, b[2]), fe, 1, j.wet, j.mem);
  }

  function emitAlong(j, op, s0, s1) {
    let a = pointAt(op, s0);
    const end = pointAt(op, s1);
    for (let k = a[3] + 1; k <= end[3]; k++) {
      if (op.cum[k] <= s0) continue;
      const q = op.pts[k];
      finger(j, a, q);
      a = [q[0], q[1], q[2], k];
    }
    finger(j, a, end);
  }

  function dripsFrom(j, op) {
    if (!j.drip) return;
    const pts = op.pts;
    const step = Math.max(1, Math.floor(pts.length / 40));
    for (let k = 0; k < pts.length; k += step) {
      const y = pts[k][1];
      const prev = pts[Math.max(0, k - 3 * step)][1];
      const next = pts[Math.min(pts.length - 1, k + 3 * step)][1];
      if (y >= prev && y >= next && chance(j.drip)) {
        pendingDrips.push({ t: T + rand(0.8, 5.5), x: pts[k][0], y: y + radius(j, pts[k][2]) * 0.55, r: Math.max(2.2, j.R * rand(0.3, 0.42)) });
      }
    }
  }

  function stepWriter(dt) {
    let budget = dt;
    while (budget > 0) {
      if (!job) {
        job = queue.shift() || null;
        if (!job) return;
        job.started = false;
      }
      if (job.wait > 0) {
        const w = Math.min(job.wait, budget);
        job.wait -= w;
        budget -= w;
        continue;
      }
      if (!job.started) {
        job.started = true;
        job.onStart?.(job);
      }
      const op = job.ops[job.i];
      if (!op) {
        const done = job;
        job = null;
        done.onDone?.(done);
        continue;
      }
      if (op.dot) {
        const [x, y, r] = op.dot;
        const rr = Math.max(job.R * 1.05, r * 0.9);
        stamp(B.wipes, x, y, x + 0.01, y, rr, rr, Math.max(1, rr * 0.2), 1, job.wet, job.mem);
        job.i++;
        job.s = 0;
        job.wait = (0.1 + rand(0.12)) * job.pause;
        continue;
      }
      const total = op.cum[op.cum.length - 1];
      const ramp = Math.max(8, job.h * 0.1);
      const ease = (0.45 + 0.55 * smooth(clamp(job.s / ramp, 0, 1))) * (0.6 + 0.4 * smooth(clamp((total - job.s) / ramp, 0, 1)));
      const v = job.v * ease;
      let s1 = job.s + v * budget;
      let used = budget;
      if (s1 >= total) {
        used = (total - job.s) / v;
        s1 = total;
      }
      emitAlong(job, op, job.s, s1);
      job.s = s1;
      budget -= used;
      if (s1 >= total) {
        dripsFrom(job, op);
        job.i++;
        job.s = 0;
        job.wait = (0.07 + rand(0.16)) * job.pause;
      }
    }
  }

  /* -------------------------------------------------------- calligraphy */

  // A line appears the way a reed pen would write it on the fogged glass; the masks know,
  // per pixel, when the pen gets there. 'play' is the ▶ mark, drawn in the shader.
  const glyphs = [];

  function glyphMeta(key) {
    return key === 'play' ? { a: 1, m: 0, len: 1.5, drips: [] } : glass[key];
  }

  function glyphBox(key, p) {
    const g = glyphMeta(key);
    const w = p.h * g.a;
    return { x0: p.cx - w / 2, y0: p.cy - p.h / 2, x1: p.cx + w / 2, y1: p.cy + p.h / 2 };
  }

  function writeGlyph(key, p, opts = {}) {
    const meta = glyphMeta(key);
    const g = {
      key,
      meta,
      p,
      start: T + (opts.delay ?? 0),
      tau: opts.instant ? 2 : 0,
      dur: opts.dur ?? clamp(meta.len * (opts.pace ?? 0.4), 0.5, 7),
      mem: opts.mem ?? 1,
      wet: opts.wet ?? 0.6,
      clear: !opts.memOnly,
      drip: reduceMotion ? 0 : opts.drip ?? 0,
      next: 0,
      onDone: opts.onDone,
      done: false,
      box: glyphBox(key, p),
    };
    glyphs.push(g);
    return g;
  }

  function stepGlyphs(dt) {
    for (const g of glyphs) {
      if (g.done || T < g.start) continue;
      g.tau += dt / g.dur;
      const drips = g.meta.drips;
      while (g.next < drips.length && drips[g.next][2] <= g.tau) {
        const [x, y] = drips[g.next++];
        if (!chance(g.drip)) continue;
        const c = Math.cos(g.p.angle || 0);
        const s = Math.sin(g.p.angle || 0);
        const lx = (x - g.meta.a / 2) * g.p.h;
        const ly = (y - 0.5) * g.p.h + g.p.h * 0.03;
        pendingDrips.push({ t: T + rand(0.6, 4.5), x: g.p.cx + c * lx - s * ly, y: g.p.cy + s * lx + c * ly, r: clamp(g.p.h * 0.022, 2.2, 5) });
      }
    }
  }

  function drawGlyphs(mode) {
    let used = false;
    for (const g of glyphs) {
      if (g.done || T < g.start || (mode === 0 && !g.clear)) continue;
      if (!used) {
        gl.useProgram(P.glyph.p);
        gl.uniform2f(P.glyph.u.uView, W, H);
        gl.uniform1i(P.glyph.u.uMode, mode);
        used = true;
      }
      const u = P.glyph.u;
      const { a, m } = g.meta;
      gl.uniform4f(u.uRect, g.p.cx, g.p.cy, (a + 2 * m) * g.p.h, (1 + 2 * m) * g.p.h);
      gl.uniform1f(u.uAngle, g.p.angle || 0);
      gl.uniform1i(u.uKind, g.key === 'play' ? 1 : 0);
      gl.uniform1f(u.uTau, g.tau);
      gl.uniform1f(u.uSoft, 0.025);
      gl.uniform1f(u.uMem, g.mem);
      gl.uniform1f(u.uWet, g.wet);
      if (g.key !== 'play') gl.bindTexture(gl.TEXTURE_2D, glassTex[g.key]);
      full4();
    }
  }

  function finishGlyphs() {
    for (const g of glyphs) {
      if (!g.done && g.tau >= 1.03) {
        g.done = true;
        g.onDone?.(g);
      }
    }
    for (let i = glyphs.length - 1; i >= 0; i--) if (glyphs[i].done) glyphs.splice(i, 1);
  }

  /* -------------------------------------------------------------- drips */

  const drips = [];
  const pendingDrips = [];

  function stepDrips(dt) {
    for (let i = pendingDrips.length - 1; i >= 0; i--) {
      const p = pendingDrips[i];
      if (T < p.t) continue;
      pendingDrips.splice(i, 1);
      if (drips.length < 140) drips.push({ x: p.x, y: p.y, r0: p.r, r: 0, t: 0, state: 0, pause: 0, alpha: 1, seed: Math.random(), life: rand(7, 13), loss: p.r / rand(45, 210) });
    }
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.t += dt;
      if (d.state === 0) {
        d.r = d.r0 * smooth(clamp(d.t / 0.8, 0, 1));
        if (d.t > 0.8) d.state = 1;
      } else if (d.state === 1) {
        if (d.pause > 0) {
          d.pause -= dt;
        } else {
          const speed = (55 + 150 * clamp(d.r / 6, 0.2, 1.4)) * (0.6 + 0.4 * Math.sin(d.t * 3 + d.seed * 9) ** 2);
          const dy = speed * dt;
          const ox = d.x;
          const oy = d.y;
          d.y += dy;
          d.x += Math.sin(d.t * 1.3 + d.seed * 20) * dy * 0.12;
          d.r -= dy * d.loss;
          stamp(B.wipes, ox, oy, d.x, d.y, d.r * 0.62, d.r * 0.62, 0.8, 1, 0.8, 0);
          if (chance(dt * 1.1)) d.pause = rand(0.08, 0.6);
          if (d.r < 1.25) {
            d.state = 2;
            d.t = 0;
          }
        }
        if (d.y > H + 20) drips.splice(i, 1);
      } else {
        d.alpha = 1 - clamp(d.t / d.life, 0, 1);
        if (d.alpha <= 0) drips.splice(i, 1);
      }
    }
    for (const d of drips) drop(B.drips, d.x, d.y, Math.max(d.r, 1.25), d.state === 1 && d.pause <= 0 ? 1.4 : 1.12, 0, 0, d.alpha, d.seed);
  }

  /* --------------------------------------------------------------- rain */

  const R = {};
  let rainDrops = [];
  let dropletsSeeded = false;
  let intensity = 0.8;

  function rainSettings() {
    const s = clamp(Math.min(W, H) / 820, 0.62, 1.15);
    const area = Math.sqrt((W * H) / (1440 * 900));
    Object.assign(R, {
      minR: 3.6 * s,
      maxR: 15 * s,
      maxDrops: Math.round((reduceMotion ? 380 : 1050) * area),
      chance: 0.42,
      limit: 4,
      dropletsRate: 22,
      dropletsSize: [0.7 * s, 2.1 * s],
      area,
    });
  }

  function newDrop(o) {
    if (rainDrops.length >= R.maxDrops) return null;
    return { x: 0, y: 0, r: 0, spreadX: 0, spreadY: 0, momentum: 0, momentumX: 0, lastSpawn: 0, nextSpawn: 0, parent: null, isNew: true, killed: false, shrink: 0, seed: Math.random(), ...o };
  }

  // After Lucas Bebber's RainDrops (Codrops, 2015): drops grow, merge and run, leaving trails.
  function stepRain(dt, emit = true) {
    const ts = Math.min(dt * 60, 3);
    const deltaR = R.maxR - R.minR;
    const out = [];
    const rate = intensity * R.area;
    if (emit && dropletsSeeded) {
      R.dropletsCounter = (R.dropletsCounter || 0) + R.dropletsRate * ts * rate;
      while (R.dropletsCounter >= 1) {
        R.dropletsCounter--;
        const r = rand(R.dropletsSize[0], R.dropletsSize[1]);
        drop(B.droplets, rand(W), rand(H), r * r / R.dropletsSize[1] + 0.3, 1, 0, 0, 1, Math.random());
      }
    }
    let count = 0;
    const limit = R.limit * ts * rate;
    while (chance(R.chance * ts * rate) && count < limit) {
      count++;
      const r = R.minR + deltaR * Math.random() ** 3;
      const d = newDrop({ x: rand(W), y: rand(-0.1 * H, 0.95 * H), r, momentum: 1 + (r - R.minR) * 0.1 + rand(2), spreadX: 1.5, spreadY: 1.5 });
      if (d) out.push(d);
    }
    rainDrops.sort((a, b) => a.y * W + a.x - (b.y * W + b.x));
    const drops = rainDrops;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (d.killed) continue;
      if (chance((d.r - R.minR) * (0.1 / deltaR) * ts)) d.momentum += rand((d.r / R.maxR) * 4);
      if (d.r <= R.minR && chance(0.05 * ts)) d.shrink += 0.01;
      d.r -= d.shrink * ts;
      if (d.r <= 0) {
        d.killed = true;
        continue;
      }
      d.lastSpawn += d.momentum * ts;
      if (d.lastSpawn > d.nextSpawn) {
        const t = newDrop({ x: d.x + rand(-d.r, d.r) * 0.1, y: d.y - d.r * 0.01, r: d.r * rand(0.2, 0.45), spreadY: d.momentum * 0.1, parent: d });
        if (t) {
          out.push(t);
          d.r *= 0.97 ** ts;
          d.lastSpawn = 0;
          d.nextSpawn = rand(R.minR, R.maxR) - d.momentum * 2 + (R.maxR - d.r);
        }
      }
      d.spreadX *= 0.4 ** ts;
      d.spreadY *= 0.7 ** ts;
      const moved = d.momentum > 0;
      const px = d.x;
      const py = d.y;
      if (moved) {
        d.y += d.momentum * ts * 0.75;
        d.x += d.momentumX * ts * 0.75;
        if (d.y > H + d.r) {
          d.killed = true;
          continue;
        }
      }
      if (moved || d.isNew) {
        for (let k = i + 1; k < Math.min(drops.length, i + 70); k++) {
          const e = drops[k];
          if (e.killed || d.r <= e.r || d.parent === e || e.parent === d) continue;
          const dx = e.x - d.x;
          const dy = e.y - d.y;
          if (Math.hypot(dx, dy) < (d.r + e.r) * (0.65 + d.momentum * 0.01 * ts)) {
            const target = Math.min(R.maxR, Math.sqrt(d.r * d.r + e.r * e.r * 0.8));
            d.r = target;
            d.momentumX += dx * 0.1;
            d.spreadX = 0;
            d.spreadY = 0;
            e.killed = true;
            d.momentum = Math.max(e.momentum, Math.min(40, d.momentum + target * 0.05 + 1));
          }
        }
      }
      d.isNew = false;
      d.momentum -= Math.max(1, R.minR * 0.5 - d.momentum) * 0.1 * ts;
      if (d.momentum < 0) d.momentum = 0;
      d.momentumX *= 0.7 ** ts;
      out.push(d);
      if (moved && emit) stamp(B.erasers, px, py, d.x, d.y, d.r * 0.55, d.r * 0.55, 0.6, 1);
    }
    rainDrops = out;
  }

  function drawRain() {
    for (const d of rainDrops) drop(B.drops, d.x, d.y, d.r, 1.3, d.spreadX, d.spreadY, 1, d.seed);
  }

  function seedDroplets() {
    const n = Math.round(3000 * R.area);
    for (let i = 0; i < n; i++) {
      const r = rand(R.dropletsSize[0], R.dropletsSize[1]);
      drop(B.droplets, rand(W), rand(H), r * r / R.dropletsSize[1] + 0.3, 1, 0, 0, 1, Math.random());
    }
    dropletsSeeded = true;
  }

  /* ------------------------------------------------------------- breath */

  const breaths = [];

  function breathe(x, y, rMax, dur, power = 1) {
    breaths.push({ x, y, rMax, dur, t: 0, power });
    audioBreath(dur);
  }

  function stepBreath(dt) {
    for (let i = breaths.length - 1; i >= 0; i--) {
      const b = breaths[i];
      b.t += dt;
      const k = clamp(b.t / b.dur, 0, 1);
      const r = b.hold ? b.rMax : b.rMax * (0.3 + 0.7 * smooth(k));
      stamp(B.breaths, b.x, b.y, b.x + 0.01, b.y, r, r, r * 0.3, dt * 1.7 * b.power);
      if (k >= 1) breaths.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------ pointer */

  const pointer = { x: 0, y: 0, has: false, down: false, mouse: true, downT: 0, moved: 0, path: [], hold: null, cursor: 0 };

  function wipeRadius(pressed, mouse) {
    const u = Math.min(W, H);
    if (pressed) return mouse ? clamp(u * 0.034, 20, 36) : clamp(u * 0.03, 12, 22);
    return mouse ? clamp(u * 0.013, 8, 14) : clamp(u * 0.03, 12, 22);
  }

  function moveTo(x, y) {
    if (pointer.has) {
      const dist = Math.hypot(x - pointer.x, y - pointer.y);
      if (dist > 0.4) {
        const pressed = pointer.down;
        const r = wipeRadius(pressed, pointer.mouse);
        const fe = Math.max(1.2, r * 0.18);
        stamp(B.wipes, pointer.x, pointer.y, x, y, r, r, fe, pressed || !pointer.mouse ? 1 : 0.9, 0.5, 0.38);
        if (pointer.down) {
          pointer.moved += dist;
          if (pointer.path.length < 400) pointer.path.push([x, y, r]);
        }
      }
    }
    pointer.x = x;
    pointer.y = y;
    pointer.has = true;
  }

  addEventListener('pointermove', (e) => {
    pointer.mouse = e.pointerType === 'mouse';
    if (!pointer.mouse && !pointer.down) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    if (list.length) for (const ev of list) moveTo(ev.clientX, ev.clientY);
    else moveTo(e.clientX, e.clientY);
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('.hit')) return;
    pointer.mouse = e.pointerType === 'mouse';
    pointer.down = true;
    pointer.downT = T;
    pointer.moved = 0;
    pointer.path = [];
    if (!pointer.mouse) pointer.has = false;
    moveTo(e.clientX, e.clientY);
    pointer.path.push([e.clientX, e.clientY, wipeRadius(true, pointer.mouse)]);
    stamp(B.wipes, e.clientX, e.clientY, e.clientX + 0.01, e.clientY, wipeRadius(true, pointer.mouse), wipeRadius(true, pointer.mouse), 2, 1, 0.5, 0.38);
  });

  const release = () => {
    if (!pointer.down) return;
    pointer.down = false;
    if (pointer.hold) pointer.hold.dur = Math.min(pointer.hold.dur, pointer.hold.t + 0.05);
    pointer.hold = null;
    if (!pointer.mouse) pointer.has = false;
    if (pointer.moved > 90 && !reduceMotion) {
      const low = pointer.path.slice().sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [x, y, r] of low) if (chance(0.6)) pendingDrips.push({ t: T + rand(0.6, 3), x, y: y + r * 0.6, r: r * rand(0.22, 0.32) });
    }
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('blur', () => {
    release();
    pointer.has = false;
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) pointer.has = false;
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('wheel', (e) => {
    const x = pointer.has ? pointer.x : W / 2;
    const y = pointer.has ? pointer.y : H / 2;
    const power = clamp(Math.abs(e.deltaY) / 240, 0.15, 0.6);
    breaths.push({ x, y, rMax: Math.min(W, H) * 0.16, dur: 0.5, t: 0, power: power * 2 });
  }, { passive: true });

  function stepPointer() {
    if (pointer.down && !pointer.hold && pointer.moved < 10 && T - pointer.downT > 0.38) {
      pointer.hold = { x: pointer.x, y: pointer.y, rMax: Math.min(W, H) * 0.14, dur: 60, t: 0, power: 1.3, hold: true };
      breaths.push(pointer.hold);
      audioBreath(2.4);
    }
    if (pointer.hold) {
      if (pointer.moved >= 10) {
        pointer.hold.dur = pointer.hold.t;
        pointer.hold = null;
      } else {
        pointer.hold.x = pointer.x;
        pointer.hold.y = pointer.y;
        pointer.hold.rMax = Math.min(W, H) * clamp(0.14 + pointer.hold.t * 0.12, 0.14, 0.34);
      }
    }
    const want = pointer.has && pointer.mouse ? 1 : 0;
    pointer.cursor += (want - pointer.cursor) * 0.2;
  }

  /* ---------------------------------------------------------- lightning */

  let flashT = -10;
  let flashPower = 0;
  let flashPulses = [];
  let nextFlash = 22;
  let fogFrom = 1;
  let fogUntil = 4;

  function lightning() {
    flashT = T;
    flashPower = rand(0.55, 1);
    flashPulses = [{ t: 0, a: 1 }, { t: rand(0.22, 0.38), a: rand(0.45, 0.8) }];
    thunder(rand(1.2, 3.4), flashPower);
  }

  function flashValue() {
    const t = T - flashT;
    if (t < 0 || t > 3) return 0;
    let v = 0.16 * Math.exp(-t * 2.2);
    for (const p of flashPulses) if (t >= p.t) v += p.a * Math.exp(-(t - p.t) * 13);
    return v * flashPower * 0.5;
  }

  /* -------------------------------------------------------------- audio */

  let audio = null;
  let soundOn = false;

  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const sr = ac.sampleRate;
    const master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    const rainBus = ac.createGain();
    rainBus.connect(master);
    const pink = ac.createBuffer(2, sr * 4, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = pink.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    const brown = ac.createBuffer(1, sr * 6, sr);
    {
      const d = brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
    }
    const tap = ac.createBuffer(1, Math.floor(sr * 0.03), sr);
    {
      const d = tap.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    }
    const bed = ac.createBufferSource();
    bed.buffer = pink;
    bed.loop = true;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 420;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5600;
    const bedGain = ac.createGain();
    bedGain.gain.value = 0.3;
    bed.connect(hp).connect(lp).connect(bedGain).connect(rainBus);
    bed.start();
    const rum = ac.createBufferSource();
    rum.buffer = brown;
    rum.loop = true;
    const rlp = ac.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 300;
    const rumGain = ac.createGain();
    rumGain.gain.value = 0.22;
    rum.connect(rlp).connect(rumGain).connect(rainBus);
    rum.start();
    return { ac, master, rainBus, brown, tap, pink, nextTap: 0 };
  }

  function audioTick() {
    if (!audio || !soundOn || audio.ac.state !== 'running') return;
    const { ac } = audio;
    const now = ac.currentTime;
    if (audio.nextTap < now) audio.nextTap = now;
    while (audio.nextTap < now + 0.15) {
      const t = audio.nextTap;
      audio.nextTap += -Math.log(1 - Math.random()) / (10 + 16 * intensity);
      const s = ac.createBufferSource();
      s.buffer = audio.tap;
      s.playbackRate.value = rand(0.5, 1.7);
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = rand(1600, 6500);
      f.Q.value = rand(2, 9);
      const g = ac.createGain();
      g.gain.value = rand(0.03, 0.16);
      s.connect(f).connect(g);
      if (ac.createStereoPanner) {
        const p = ac.createStereoPanner();
        p.pan.value = rand(-0.85, 0.85);
        g.connect(p).connect(audio.rainBus);
      } else {
        g.connect(audio.rainBus);
      }
      s.start(t);
    }
  }

  function thunder(delay, power) {
    if (!audio || !soundOn) return;
    const { ac } = audio;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource();
    s.buffer = audio.brown;
    s.playbackRate.value = rand(0.45, 0.75);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(100, t + 4.5);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.1 * power, t + rand(0.12, 0.45));
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(5.5, 7.5));
    s.connect(f).connect(g).connect(audio.master);
    s.start(t);
    s.stop(t + 8);
  }

  function audioBreath(dur) {
    if (!audio || !soundOn) return;
    const { ac } = audio;
    const t = ac.currentTime;
    const s = ac.createBufferSource();
    s.buffer = audio.pink;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(3, dur + 0.6));
    s.connect(f).connect(g).connect(audio.master);
    s.start(t, rand(0, 2));
    s.stop(t + 3.2);
  }

  function setSound(on) {
    soundOn = on;
    soundBtn.setAttribute('aria-pressed', String(on));
    if (on && !audio) audio = makeAudio();
    if (!audio) return;
    const { ac, master } = audio;
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    if (on) {
      ac.resume();
      master.gain.linearRampToValueAtTime(0.85, t + 1.6);
    } else {
      master.gain.linearRampToValueAtTime(0, t + 0.4);
    }
    duck();
  }

  function duck() {
    if (!audio) return;
    const g = audio.rainBus.gain;
    const t = audio.ac.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(teaserOn ? 0.15 : 1, t + 0.8);
  }

  soundBtn.addEventListener('click', () => setSound(!soundOn));

  /* ------------------------------------------------------------- teaser */

  let teaserOn = false;
  let regrow = 1;
  let teaserMix = 0;
  let expo = 0;
  let expoTarget = 1;
  let pendingSource = null;
  let switching = false;

  function switchSource(next) {
    pendingSource = next;
    switching = true;
    expoTarget = 0;
  }

  function startTeaser() {
    teaserOn = true;
    playBtn.setAttribute('aria-label', 'توقف تیزر');
    teaser.muted = false;
    if (teaser.preload !== 'auto') {
      teaser.preload = 'auto';
      teaser.load();
    }
    try {
      teaser.currentTime = 0;
    } catch (err) {
      /* not loaded yet */
    }
    const p = teaser.play();
    if (p) p.catch(() => stopTeaser());
    regrow = 0.12;
    const m = Math.min(W, H) * 0.08;
    const rect = { x0: m, y0: H * 0.16, x1: W - m, y1: H * 0.84 };
    const rows = portrait ? 6 : 4;
    const pts = sleeve(rect, rows);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const r = ((rect.y1 - rect.y0) / rows) * 0.72;
    if (job) queue.unshift(job);
    queue.unshift({ ops: [{ pts, cum }], i: 0, s: 0, wait: 0, R: r, wMed: 1, h: r * 4, v: 2600, pause: 0, mem: 0, wet: 0.9, drip: 0, box: rect });
    job = null;
    if (!reduceMotion) {
      for (let i = 0; i < 7; i++) pendingDrips.push({ t: T + rand(1.2, 4), x: rand(rect.x0, rect.x1), y: rect.y1 + r * 0.5, r: rand(3, 5.5) });
    }
    duck();
  }

  function stopTeaser() {
    if (!teaserOn) return;
    teaserOn = false;
    playBtn.setAttribute('aria-label', 'پخش تیزر آلبوم «نمی‌کاهم»');
    teaser.pause();
    regrow = 1;
    if (source === teaser || pendingSource === teaser) switchSource(outside);
    duck();
  }

  teaser.addEventListener('playing', () => {
    if (teaserOn && source !== teaser) switchSource(teaser);
  });
  teaser.addEventListener('ended', stopTeaser);
  playBtn.addEventListener('click', () => (teaserOn ? stopTeaser() : startTeaser()));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stopTeaser();
  });

  /* ----------------------------------------------------------- timeline */

  let T = 0;
  const events = [];
  const at = (t, fn) => events.push({ t, fn });
  const verseKeys = ['v1', 'v2', 'v3', 'v4'];
  let verseIndex = 0;
  let verseH = 1;

  function reveal(el, box, pad) {
    placeHit(el, box, pad);
    el.hidden = false;
  }

  function nextVerse() {
    const key = verseKeys[verseIndex % verseKeys.length];
    const a = glass[key].a;
    const margin = Math.max(18, Math.min(W, H) * 0.05);
    let h = (portrait ? clamp(H * 0.055, 36, 54) : clamp(H * 0.085, 54, 96)) * verseH;
    h = Math.min(h, (W - margin * 2) / a);
    const quiet = [glyphBox('v4', L.hidden), glyphBox('breathe', L.breathe)];
    const fixed = [L.emblemRect, glyphBox('album', L.album), glyphBox('play', L.play), glyphBox('handle', L.handle), glyphBox('sound', L.sound)];
    const recent = written.slice(-3);
    for (let tries = 0; tries < 80; tries++) {
      const w = h * a;
      const cx = margin + w / 2 + rand(Math.max(0, W - margin * 2 - w));
      const cy = margin + h / 2 + rand(Math.max(0, H - margin * 2 - h - 40));
      const p = { cx, cy, h, angle: rand(-0.06, 0.06) };
      const box = glyphBox(key, p);
      if (fixed.some((r) => overlaps(r, box, 20)) || quiet.some((r) => overlaps(r, box, 60)) || recent.some((r) => overlaps(r, box, 10))) continue;
      verseIndex++;
      verseH = 1;
      written.push(box);
      writeGlyph(key, p, { delay: 0.2, mem: 0.75, drip: 0.12, wet: 0.5, pace: 0.5 });
      return;
    }
    verseH = Math.max(0.6, verseH * 0.85);
  }

  function scheduleIntro() {
    const intro = !reduceMotion;
    const t0 = T;
    const first = intro ? Math.max(0.5, 4.2 - T) : 0.5;
    const album = writeGlyph('album', L.album, { delay: first, mem: 1, drip: 0.35, pace: 0.45 });
    const play = writeGlyph('play', L.play, { delay: first + album.dur + 0.4, dur: 0.6, mem: 1, onDone: (g) => reveal(playBtn, g.box, 14) });
    const sound = writeGlyph('sound', L.sound, { delay: first + album.dur + 1.6, mem: 1, pace: 0.3, onDone: (g) => reveal(soundBtn, g.box, 12) });
    writeGlyph('handle', L.handle, { delay: first + album.dur + 1.9 + sound.dur, dur: 1.4, mem: 1, onDone: (g) => reveal(handleLink, g.box, 10) });
    writeGlyph('v4', L.hidden, { instant: true, memOnly: true, mem: 0.42, wet: 0 });
    if (maskTex) maskPending = true;
    else emblemImg.then((img) => img && pressEmblem(img));
    at(t0 + 18, nextVerse);
    at(t0 + 31, () => {
      writeGlyph('breathe', L.breathe, {
        mem: 0.75,
        pace: 0.4,
        onDone: () => at(T + 1.1, () => breathe(L.hidden.cx, L.hidden.cy, Math.max(L.hidden.h * glass.v4.a * 0.78, 100), 2.4, 1.2)),
      });
    });
    at(t0 + 50, function verses() {
      nextVerse();
      at(T + rand(15, 23), verses);
    });
    if (!reduceMotion) {
      at(t0 + rand(4, 7), function condensation() {
        if (drips.length < 60) pendingDrips.push({ t: T, x: rand(W * 0.04, W * 0.96), y: rand(H * 0.04, H * 0.55), r: rand(2.4, 4.6) });
        at(T + rand(2.5, 6.5), condensation);
      });
    }
  }

  function runEvents() {
    for (let i = events.length - 1; i >= 0; i--) {
      if (T >= events[i].t) {
        const e = events.splice(i, 1)[0];
        e.fn();
      }
    }
  }

  /* ------------------------------------------------------------- emblem */

  let maskTex = null;
  let maskPending = false;

  function pressEmblem(img) {
    const h = 1024;
    const w = Math.round(h * EMBLEM_A);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    if (!maskTex) maskTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    maskPending = true;
  }

  async function loadGlass() {
    const res = await fetch('assets/data/glass/glass.json');
    const meta = await res.json();
    await Promise.all(Object.entries(meta).map(async ([key, g]) => {
      const img = await loadImage(`assets/data/glass/${g.f}`);
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      glassTex[key] = t;
    }));
    return meta;
  }

  /* ------------------------------------------------------------- render */

  let frame = 0;

  function bind(t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
  }

  function full() {
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function useStamp(mode) {
    gl.useProgram(P.stamp.p);
    gl.uniform2f(P.stamp.u.uView, W, H);
    gl.uniform1i(P.stamp.u.uMode, mode);
  }

  function useDrop() {
    gl.useProgram(P.drop.p);
    gl.uniform2f(P.drop.u.uView, W, H);
  }

  function render(dt, flash, show = true) {
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);

    // droplets: the fine spray that stays on the glass until a running drop collects it
    bind(dropletsT);
    if (B.droplets.n) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      useDrop();
      drawInstances(B.droplets);
    }
    if (B.erasers.n) {
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      useStamp(3);
      drawInstances(B.erasers);
    }

    // the rain map: droplets + drops
    bind(rainT);
    gl.clearColor(0.5, 0.5, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.copy.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dropletsT.tex);
    full();
    useDrop();
    drawInstances(B.drops);

    bind(dripT);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawInstances(B.drips);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, rainT.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // the fog: regrow, then apply this frame's fingers, grease and breath
    bind(fogB);
    gl.disable(gl.BLEND);
    gl.useProgram(P.update.p);
    const u = P.update.u;
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uRegrow, 0.085 * regrow * (T < fogFrom ? 0.05 : T < fogUntil ? 7 : 1));
    gl.uniform1f(u.uBreathK, 0.36);
    gl.uniform1f(u.uDryK, 0.22);
    gl.uniform1f(u.uMemK, 0.012);
    gl.uniform1f(u.uFrame, frame % 4096);
    gl.uniform1f(u.uDither, fogFmt === byte ? 1 : 0);
    gl.uniform1f(u.uAspect, W / H);
    gl.bindTexture(gl.TEXTURE_2D, fogA.tex);
    full();
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MIN);
    if (B.wipes.n) {
      useStamp(0);
      drawInstances(B.wipes);
    }
    drawGlyphs(0);
    gl.blendEquation(gl.MAX);
    if (B.wipes.n) {
      useStamp(1);
      drawInstances(B.wipes);
    }
    drawGlyphs(1);
    if (B.marks.n) {
      gl.blendEquation(gl.MAX);
      useStamp(1);
      drawInstances(B.marks);
    }
    if (maskPending && maskTex) {
      gl.blendEquation(gl.MAX);
      gl.useProgram(P.mask.p);
      const m = P.mask.u;
      gl.uniform2f(m.uView, W, H);
      gl.uniform4f(m.uRect, L.emblem.cx, L.emblem.cy, L.emblem.h * EMBLEM_A, L.emblem.h);
      gl.uniform1f(m.uAngle, 0);
      gl.uniform1f(m.uMem, 1);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      full4();
      maskPending = false;
    }
    if (B.breaths.n) {
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      useStamp(2);
      drawInstances(B.breaths);
    }
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    [fogA, fogB] = [fogB, fogA];

    if (!show) return;

    // the window
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(P.comp.p);
    const c = P.comp.u;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, rainT.tex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, dripT.tex);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, fogA.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    const As = W / H;
    const Av = sceneW / sceneH;
    let sx = As > Av ? 1 : As / Av;
    let sy = As > Av ? Av / As : 1;
    sx /= 1.05;
    sy /= 1.05;
    par.x += ((pointer.has ? pointer.x / W : 0.5) - par.x) * 0.03;
    par.y += ((pointer.has ? pointer.y / H : 0.5) - par.y) * 0.03;
    gl.uniform2f(c.uView, W, H);
    gl.uniform2f(c.uSceneScale, sx, sy);
    gl.uniform2f(c.uSceneOffset, 0.5 - 0.5 * sx - (par.x - 0.5) * (1 - sx) * 0.8, 0.5 - 0.5 * sy + (par.y - 0.5) * (1 - sy) * 0.8);
    gl.uniform2f(c.uSceneTexel, 1 / sceneW, 1 / sceneH);
    const lamp = L.lamp || [W * 0.9, H * 0.14];
    gl.uniform2f(c.uLamp, lamp[0], lamp[1]);
    gl.uniform3f(c.uCursor, pointer.x, pointer.y, pointer.cursor);
    gl.uniform1f(c.uTime, T);
    gl.uniform1f(c.uFlash, flash);
    gl.uniform1f(c.uExpo, expo);
    gl.uniform1f(c.uSceneMix, sceneMix);
    gl.uniform1f(c.uTeaser, teaserMix);
    gl.uniform1f(c.uSceneAspect, sceneW / sceneH);
    const fl = 0.9 + 0.1 * Math.sin(T * 1.7) * Math.sin(T * 0.63 + 2);
    gl.uniform4fv(c.uLights, [0.56, 0.43, 0.003, 2.2 * fl, 0.705, 0.418, 0.0021, 1.2, 0.2, 0.36, 0.0017, 0.7 * (2 - fl)]);
    full();
  }

  const par = { x: 0.5, y: 0.5 };

  function full4() {
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* --------------------------------------------------------------- loop */

  let last = performance.now();
  let slow = 0;
  let measured = 0;
  let fixedStep = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const raw = (now - last) / 1000;
    last = now;
    const dt = fixedStep || clamp(raw, 0.001, 0.05);

    // keep the frame rate: drop resolution if frames keep running long
    if (T > 3 && raw < 0.5) {
      measured++;
      slow = slow * 0.97 + (raw > 0.026 ? 1 : 0) * 0.03;
      if (measured > 120 && slow > 0.6 && pixelBudget > 0.6e6) {
        pixelBudget *= 0.7;
        sizeCanvas();
        measured = 0;
        slow = 0;
      }
    }

    simulate(dt);
    render(dt, reduceMotion ? 0 : flashValue());
    endFrame();
    finishGlyphs();
  }

  function endFrame() {
    for (const b of Object.values(B)) {
      b.n = 0;
      b.sent = false;
    }
  }

  function simulate(dt) {
    T += dt;
    frame++;

    // exposure, source switching, teaser grading
    const rateE = expoTarget > expo ? 1.4 : 4;
    expo += (expoTarget - expo) * Math.min(1, dt * rateE);
    if (switching && expo < 0.04) {
      switching = false;
      source = pendingSource;
      freshFrame = true;
      lastVideoTime = -1;
      expoTarget = 1;
      if (source === outside && !reduceMotion) outside.play().catch(() => {});
    }
    teaserMix += ((source === teaser ? 1 : 0) - teaserMix) * Math.min(1, dt * 3);
    sceneMix += (sceneMixTarget - sceneMix) * Math.min(1, dt * 1.5);
    pumpScene();

    intensity = clamp(0.62 + 0.3 * Math.sin(T * 0.071) + 0.16 * Math.sin(T * 0.23 + 1.3), 0.3, 1);
    if (glass) runEvents();
    if (!reduceMotion && T > nextFlash) {
      lightning();
      nextFlash = T + rand(24, 55);
    }
    stepPointer();
    stepWriter(dt);
    stepGlyphs(dt);
    stepBreath(dt);
    stepDrips(dt);
    stepRain(dt * (reduceMotion ? 0.35 : 1));
    drawRain();
    audioTick();
  }

  /* -------------------------------------------------------------- start */

  function resize(force) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!force && w === W && Math.abs(h - H) / H < 0.25) {
      H = h;
      sizeCanvas();
      return;
    }
    W = w;
    H = h;
    sizeCanvas();
    buildTargets();
    rainSettings();
    rainDrops = [];
    for (let i = 0; i < 260; i++) stepRain(1 / 60, false);
    dropletsSeeded = false;
    seedDroplets();
    queue.length = 0;
    job = null;
    events.length = 0;
    drips.length = 0;
    pendingDrips.length = 0;
    breaths.length = 0;
    written.length = 0;
    glyphs.length = 0;
    [playBtn, soundBtn, handleLink].forEach((el) => (el.hidden = true));
    if (force) T = 0;
    fogFrom = T + (force ? 1.1 : 0);
    fogUntil = fogFrom + 3;
    nextFlash = Math.max(nextFlash, T + 20);
    if (glass) {
      layout();
      scheduleIntro();
    }
  }

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resize(false), 160);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      outside.pause();
    } else if (source === outside) {
      outside.play().catch(() => {});
    }
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.classList.add('no-gl');
  });

  if (/[?&]debug\b/.test(location.search)) {
    window.__glass = {
      get T() { return T; },
      get dpr() { return dpr; },
      breathe,
      lightning,
      // run the glass forward without drawing the window, for screenshots in slow software GL
      warp(sec, step = 1 / 30) {
        for (let t = 0; t < sec; t += step) {
          simulate(step);
          render(step, 0, false);
          endFrame();
          finishGlyphs();
        }
        return T;
      },
      step(s) { fixedStep = s; },
      state() { return { down: pointer.down, moved: pointer.moved, hold: !!pointer.hold, breaths: breaths.length, downT: pointer.downT, T }; },
    };
  }

  resize(true);
  root.classList.add('gl');
  requestAnimationFrame(tick);

  try {
    glass = await loadGlass();
    layout();
    scheduleIntro();
  } catch (err) {
    console.error(err);
  }
}

if (!gl) {
  root.classList.add('no-gl');
} else {
  start().catch((err) => {
    console.error(err);
    root.classList.add('no-gl');
  });
}
