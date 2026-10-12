// Arte con IA: un campo de ruido que se limpia paso a paso (difusión) y se decodifica.
// La imagen final reinterpreta el bisonte del capítulo 1 con el lenguaje de un generador:
// contraluz, volumen, pelo encendido en el borde. Para eso el dibujo se convierte una vez
// en una textura con volumen: R altura «inflada» · G lana · B silueta difuminada · A cuernos.
import { createProgram, FULLSCREEN_VERTEX, drawFullscreen } from '../gl.js';
import common from '../glsl/common.glsl?raw';
import aiFrag from '../glsl/ai.frag?raw';
import { BISON_W, BISON_H } from './bison.js';

// El bisonte «reinterpretado»: el mismo lienzo de 200 × 120 unidades y la misma pose que el
// de Altamira (mira a la izquierda, cabeza baja), pero con la anatomía que pondría un
// generador: giba alta sobre las manos, barba, zahones de lana, patas finas y grupa menor.
const SILHOUETTE = `
  M 14 78 C 12 68 16 58 24 52 C 28 48 31 46 34 44 C 40 30 52 14 72 10
  C 96 8 120 22 140 30 C 156 34 170 36 178 44 C 184 52 184 64 180 72
  C 178 82 176 92 178 108 C 178 111 177 112 175 112 L 172 112
  C 170 100 170 92 166 84 C 160 86 152 86 146 88 C 130 92 110 94 96 90
  C 96 98 94 104 95 109 C 95 111 94 112 92 112 L 88 112
  C 88 104 86 96 84 88 C 78 94 68 96 60 92 C 52 98 44 101 40 92
  C 32 90 22 88 16 84 C 13 82 13 80 14 78 Z`;
const FAR_LEGS = [
  'M 76 86 C 76 98 77 104 76 110 C 77 112 81 112 82 110 C 82 102 82 96 84 88 Z',
  'M 154 86 C 157 96 159 102 159 110 C 160 112 164 112 165 110 C 165 100 164 92 163 85 Z',
];
const TAIL = 'M 180 50 C 189 54 191 64 189 77';
const TUFT = 'M 189 74 C 194 77 194 86 188 90 C 184 86 185 79 189 74 Z';
const WOOL = [
  // cabeza, cuello y giba: la lana espesa de delante
  `M 14 78 C 12 68 16 58 24 52 C 28 48 31 46 34 44 C 40 30 52 14 72 10 C 80 9 88 10 94 12
   C 88 30 86 52 88 70 C 88 80 87 86 84 88 C 78 94 68 96 60 92 C 52 98 44 101 40 92
   C 32 90 22 88 16 84 Z`,
  // zahones: la lana que cubre la parte alta de las manos
  'M 80 84 C 84 92 92 96 98 92 C 97 84 92 78 86 76 Z',
];
const HORNS = ['M 30 50 C 25 44 23 37 28 30', 'M 38 46 C 36 40 38 34 43 30'];
import { PUNTILLISMO, PREHISTORIA } from '../palettes.js';
import { bisonMask } from './charcoal.js';
import { setPointerUniform } from '../../motion/pointer.js';

const keyOf = (params) =>
  Object.values(params)
    .filter((v) => typeof v === 'number')
    .map((v) => v.toFixed(4))
    .join(',');

const pigment = (name) => PUNTILLISMO.find((p) => p.name === name).rgb;
const SCREEN = [0.075, 0.072, 0.08]; // pantalla apagada: un gris casi negro, algo violáceo
const K = 4; // px de textura por unidad del dibujo (800 × 480)

// Pinta rutas en una capa y devuelve su canal alfa como Float32 0–1
function layer(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(K, K);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = src[i * 4 + 3] / 255;
  return out;
}

// Desenfoque de caja separable (dos pasadas ≈ gaussiano)
function blur(a, w, h, r) {
  const tmp = new Float32Array(a.length);
  const pass = (src, dst, horizontal) => {
    const n = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      let acc = 0;
      const at = (i) => (horizontal ? l * w + Math.min(n - 1, Math.max(0, i)) : Math.min(n - 1, Math.max(0, i)) * w + l);
      for (let i = -r; i <= r; i++) acc += src[at(i)];
      for (let i = 0; i < n; i++) {
        dst[horizontal ? l * w + i : i * w + l] = acc / (2 * r + 1);
        acc += src[at(i + r + 1)] - src[at(i - r)];
      }
    }
  };
  for (let k = 0; k < 2; k++) {
    pass(a, tmp, true);
    pass(tmp, a, false);
  }
  return a;
}

// Distancia al borde (chaflán 3-4, dos pasadas), en px, dentro de la silueta
function distance(cov, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = cov[i] > 0.5 ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) v = Math.min(v, d[i - w] + 3);
      if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + 4);
      if (x < w - 1 && y > 0) v = Math.min(v, d[i - w + 1] + 4);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) v = Math.min(v, d[i + w] + 3);
      if (x < w - 1 && y < h - 1) v = Math.min(v, d[i + w + 1] + 4);
      if (x > 0 && y < h - 1) v = Math.min(v, d[i + w - 1] + 4);
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

function bisonVolume(gl) {
  const w = BISON_W * K;
  const h = BISON_H * K;
  const fill = (paths) => (ctx) => paths.forEach((p) => ctx.fill(new Path2D(p)));
  const tail = TAIL;
  const horns = HORNS;

  const cov = layer(w, h, (ctx) => {
    fill([SILHOUETTE, ...FAR_LEGS, TUFT])(ctx);
    ctx.lineWidth = 2.6;
    ctx.stroke(new Path2D(tail));
  });
  const dist = distance(cov, w, h);
  const height = new Float32Array(w * h);
  for (let i = 0; i < height.length; i++) {
    const k = Math.min(dist[i] / (22 * K), 1);
    height[i] = 1 - (1 - k) * (1 - k); // perfil redondeado: bordes que caen deprisa
  }
  blur(height, w, h, 5);
  const wool = blur(layer(w, h, fill([...WOOL, TUFT])), w, h, 28);
  const soft = blur(cov.slice(), w, h, 5);
  // Cuernos afilados: discos que adelgazan de la base a la punta a lo largo de la curva
  const hornMask = blur(
    layer(w, h, (ctx) => {
      horns.forEach((d) => {
        const [x0, y0, x1, y1, x2, y2, x3, y3] = d.match(/-?\d+(\.\d+)?/g).map(Number);
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const s = 1 - t;
          const x = s * s * s * x0 + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t * t * t * x3;
          const y = s * s * s * y0 + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t * t * t * y3;
          ctx.beginPath();
          ctx.arc(x, y, 3.4 * (1 - t) + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }),
    w,
    h,
    2,
  );

  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = Math.round(height[i] * 255);
    data[i * 4 + 1] = Math.round(wool[i] * 255);
    data[i * 4 + 2] = Math.round(soft[i] * 255);
    data[i * 4 + 3] = Math.round(hornMask[i] * 255);
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, w, h };
}

// Dos maneras de pedir la imagen, sobre el mismo avance k (0–1) que mueve el scroll:
//   'img' imagen → imagen: se parte del bisonte de la cueva, se codifica al espacio latente,
//         se le añade ruido hasta la fuerza 0,72 y se limpia hacia un estudio a carboncillo
//         (0,72 × 50 = 36 pasos, como en un img2img de verdad)
//   'txt' texto → imagen: se parte de ruido puro y se limpia en 50 pasos hacia la imagen de cine
export const STRENGTH = 0.72;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function diffusion(k, mode) {
  if (mode === 'txt') {
    const t = 1 - clamp01((k - 0.08) / 0.76);
    const stage = k < 0.08 ? 'noise' : k < 0.85 ? 'denoise' : k < 0.98 ? 'decode' : 'done';
    return { appear: clamp01(k / 0.08), t, decode: clamp01((k - 0.86) / 0.12), src: 0, steps: Math.round((1 - t) * 50), total: 50, stage };
  }
  const total = Math.round(STRENGTH * 50);
  let t = 0;
  if (k >= 0.14 && k < 0.36) t = (STRENGTH * (k - 0.14)) / 0.22;
  else if (k >= 0.36 && k < 0.84) t = STRENGTH * (1 - (k - 0.36) / 0.48);
  let decode = 0;
  if (k < 0.06) decode = 1;
  else if (k < 0.14) decode = 1 - (k - 0.06) / 0.08;
  else if (k >= 0.86) decode = clamp01((k - 0.86) / 0.12);
  const steps = k < 0.36 ? 0 : Math.round(((STRENGTH - t) / STRENGTH) * total);
  const stage = k < 0.06 ? 'input' : k < 0.14 ? 'encode' : k < 0.36 ? 'forward' : k < 0.85 ? 'denoise' : k < 0.98 ? 'decode' : 'done';
  return { appear: 1, t, decode, src: 1 - smooth(0.34, 0.38, k), steps, total, stage };
}

export class AiScene {
  constructor() {
    this.name = 'ai';
    this.mode = 'img';
    this.params = { k: 0, fade: 1 };
  }

  get state() {
    return diffusion(this.params.k, this.mode);
  }

  key() {
    return `${keyOf(this.params)},${this.mode}`;
  }

  init(gl) {
    this.prog = createProgram(gl, FULLSCREEN_VERTEX, `${common}\n${aiFrag}`);
    this.gl = gl;
    this.volume = null; // se construye la primera vez que hace falta (≈ 40 ms, una vez)
    this.mask = bisonMask(gl); // el bisonte del capítulo 1, imagen de partida
  }

  prepare() {
    if (!this.volume && this.gl) this.volume = bisonVolume(this.gl);
  }

  render(gl, view) {
    this.prepare();
    const p = this.params;
    const { program, uniforms: u } = this.prog;
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.volume.tex);
    gl.uniform1i(u.u_bison, 0);
    gl.uniform2f(u.u_texel, 1 / this.volume.w, 1 / this.volume.h);
    gl.uniform2f(u.u_size, view.cssWidth, view.cssHeight);
    const st = this.state;
    gl.uniform1f(u.u_appear, st.appear);
    gl.uniform1f(u.u_t, st.t);
    gl.uniform1f(u.u_decode, st.decode);
    gl.uniform1i(u.u_mode, this.mode === 'img' ? 1 : 0);
    gl.uniform1f(u.u_src, st.src);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.uniform1i(u.u_mask, 1);
    gl.uniform2f(u.u_maskTexel, 1 / (BISON_W * 5), 1 / (BISON_H * 5));
    gl.uniform3fv(u.u_rock, PREHISTORIA.ground);
    gl.uniform3fv(u.u_ochre, PREHISTORIA.ochre);
    gl.uniform3fv(u.u_charcoal, PREHISTORIA.charcoal);
    gl.uniform3fv(u.u_paper, [0.93, 0.91, 0.86]);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.u_alpha, p.fade);
    setPointerUniform(gl, u.u_ptr, this);
    gl.uniform1i(u.u_octaves, view.quality.octaves);
    gl.uniform3fv(u.u_screen, SCREEN);
    gl.uniform3fv(u.u_p0, pigment('Ultramar'));
    gl.uniform3fv(u.u_p1, pigment('Violeta'));
    gl.uniform3fv(u.u_p2, pigment('Bermellón'));
    gl.uniform3fv(u.u_p3, pigment('Amarillo'));
    gl.uniform3fv(u.u_p4, pigment('Blanco'));
    gl.uniform3fv(u.u_p5, pigment('Cobalto'));
    drawFullscreen(gl);
  }
}
