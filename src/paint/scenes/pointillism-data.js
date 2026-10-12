// Datos del puntillismo: el motivo, la asignación de pigmentos y la posición de
// cada toque. Es JS puro para poder correr en un Worker: con 44 000 toques tarda
// ~110 ms en un portátil, demasiado para el hilo principal.
import { PUNTILLISMO } from '../palettes.js';

// --- Aleatorio y ruido deterministas (mismo cuadro en cada carga) ------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
  return noise(x, y) * 0.5 + noise(x * 2.03 + 17, y * 2.03 + 17) * 0.25 + noise(x * 4.1 + 31, y * 4.1 + 31) * 0.125;
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

// --- El motivo: orilla de río a media tarde (sRGB) ---------------------------
export const SUN = [0.7, 0.72];

function landscape(u, v) {
  const treeline = 0.55 + 0.09 * fbm(u * 5, 1.3) + 0.04 * Math.sin(u * 9);
  const bank = 0.3 + 0.05 * Math.sin(u * 3.2 + 0.6) + 0.02 * fbm(u * 8, 4);
  const shore = 0.5;

  if (v > treeline) {
    // Cielo: azul arriba, calor junto al horizonte, bruma alrededor del sol
    let c = mix3([0.97, 0.88, 0.64], [0.55, 0.72, 0.93], smooth(treeline, 1, v));
    const d = Math.hypot(u - SUN[0], (v - SUN[1]) * 1.3);
    c = mix3(c, [1, 0.94, 0.72], Math.exp(-(d * d) / 0.012));
    const cloud = smooth(0.55, 0.75, fbm(u * 3, v * 7));
    return mix3(c, [0.95, 0.9, 0.86], cloud * 0.5);
  }
  if (v > shore) {
    // Orilla lejana: masa de árboles en sombra, con luz en el borde superior
    const lit = smooth(treeline - 0.04, treeline, v);
    const dark = fbm(u * 10, v * 10);
    return mix3(mix3([0.13, 0.3, 0.2], [0.22, 0.4, 0.16], dark), [0.5, 0.6, 0.25], lit * 0.6);
  }
  if (v > bank) {
    // Agua: refleja árboles arriba y el sol en una columna rota
    let c = mix3([0.3, 0.48, 0.72], [0.45, 0.6, 0.82], fbm(u * 2, v * 20));
    c = mix3(c, [0.16, 0.32, 0.26], smooth(shore - 0.06, shore, v) * 0.7);
    const glitter = Math.exp(-(((u - SUN[0]) / 0.06) ** 2)) * smooth(0.45, 0.6, fbm(u * 6, v * 50));
    return mix3(c, [0.99, 0.92, 0.7], glitter * 0.8);
  }
  // Primer término: hierba al sol y sombras frías bajo los árboles
  const shade = smooth(0.5, 0.65, fbm(u * 2.5 + 3, v * 4));
  const sunny = mix3([0.5, 0.68, 0.22], [0.78, 0.76, 0.3], smooth(0.4, 0.8, fbm(u * 6, v * 6)));
  return mix3(sunny, [0.18, 0.3, 0.36], shade * 0.85);
}

// --- Asignación de pigmentos por mezcla óptica -------------------------------
const toLin = (c) => c.map((x) => x ** 2.2);

function assign(target, palLin, rand) {
  let best = 0;
  let bestOther = 0;
  let bestW = 1;
  let bestErr = Infinity;
  for (let i = 0; i < palLin.length; i++) {
    for (let j = i; j < palLin.length; j++) {
      const A = palLin[i];
      const B = palLin[j];
      const ab = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
      const len = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
      const w = len > 0 ? Math.min(Math.max(((target[0] - B[0]) * ab[0] + (target[1] - B[1]) * ab[1] + (target[2] - B[2]) * ab[2]) / len, 0), 1) : 1;
      const m0 = B[0] + w * ab[0] - target[0];
      const m1 = B[1] + w * ab[1] - target[1];
      const m2 = B[2] + w * ab[2] - target[2];
      const err = m0 * m0 + m1 * m1 + m2 * m2;
      if (err < bestErr) {
        bestErr = err;
        best = i;
        bestOther = j;
        bestW = w;
      }
    }
  }
  return rand() < bestW ? best : bestOther;
}

// Densidad: un toque cada ~3,5 px CSS, entre 3,2 y 6 px; tope de 60 000 toques.
export function buildPoints(cssWidth, cssHeight) {
  const spacing = Math.min(Math.max(cssWidth / 220, 3.2), 6);
  let cols = Math.floor(cssWidth / spacing);
  let rows = Math.floor(cssHeight / spacing);
  const cap = 60000;
  if (cols * rows > cap) {
    const k = Math.sqrt(cap / (cols * rows));
    cols = Math.floor(cols * k);
    rows = Math.floor(rows * k);
  }
  const rand = mulberry32(1886);
  const palLin = PUNTILLISMO.map((p) => toLin(p.rgb));
  const count = cols * rows;
  const data = new Float32Array(count * 9);
  let o = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = (x + 0.5 + (rand() - 0.5) * 0.9) / cols;
      const v = (y + 0.5 + (rand() - 0.5) * 0.9) / rows;
      const idx = assign(toLin(landscape(u, v)), palLin, rand);
      // En la paleta: ocho montones de color, alineados con las muestras de abajo
      const sx = (idx + 0.5) / PUNTILLISMO.length + (rand() + rand() - 1) * 0.04;
      const sy = 0.1 + (rand() + rand() + rand() - 1.5) * 0.06;
      const [r, g, b] = PUNTILLISMO[idx].rgb;
      data.set([u, v, sx, sy, r, g, b, rand(), rand()], o);
      o += 9;
    }
  }
  return { data, count, spacing: Math.min(cssWidth / cols, cssHeight / rows) };
}
