import { BISON_W, BISON_H, CONTOUR, ENGRAVING, BULGES } from './bison.js';

// Los dos dibujos al carboncillo, como trazos con su orden y su tiempo.
// Unidades de dibujo: 1 = alto del dibujo; y crece hacia abajo.
// Cada trazo: { pts, w (ancho), press (presión 0–1), t0, t1 (tramo de u_draw), jitter }

// --- Rutas SVG mínimas (M, L, C en coordenadas absolutas) ---------------------
export function samplePath(d, scale) {
  const tokens = d.trim().split(/[\s,]+/);
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  let cmd = '';
  const num = () => Number(tokens[i++]) / scale;
  while (i < tokens.length) {
    if (/[MLC]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      pts.push(cur);
    } else if (cmd === 'L') {
      const p = [num(), num()];
      for (let k = 1; k <= 12; k++) pts.push([cur[0] + (p[0] - cur[0]) * (k / 12), cur[1] + (p[1] - cur[1]) * (k / 12)]);
      cur = p;
    } else if (cmd === 'C') {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const p = [num(), num()];
      for (let k = 1; k <= 24; k++) {
        const t = k / 24;
        const u = 1 - t;
        pts.push([
          u * u * u * cur[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p[0],
          u * u * u * cur[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p[1],
        ]);
      }
      cur = p;
    }
  }
  return pts;
}

const lengthOf = (pts) => pts.slice(1).reduce((sum, p, k) => sum + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);

// Reparte un tramo de tiempo entre trazos, en proporción a su longitud
function schedule(strokes, t0, t1) {
  const total = strokes.reduce((s, st) => s + lengthOf(st.pts), 0);
  let t = t0;
  for (const st of strokes) {
    const dt = ((t1 - t0) * lengthOf(st.pts)) / total;
    st.t0 = t;
    st.t1 = t + dt;
    t += dt;
  }
  return strokes;
}

// --- Cueva: bisonte polícromo al modo de Altamira (ver bison.js) ------------
// Primero el contorno a carbón, luego el repaso y al final el grabado de la crinera.
export function caveDrawing() {
  const S = BISON_H;
  const contour = CONTOUR.map((d) => ({ pts: samplePath(d, S), w: 0.016, press: 0.95, jitter: 0.002 }));
  const retrace = CONTOUR.slice(0, 3).map((d) => ({ pts: samplePath(d, S), w: 0.01, press: 1, jitter: 0.003 }));
  const engraving = ENGRAVING.map((d) => ({ pts: samplePath(d, S), w: 0.004, press: 0.9, jitter: 0.001, engrave: true }));
  return {
    aspect: BISON_W / BISON_H,
    margin: 0.9,
    strokes: [...schedule(contour, 0, 0.7), ...schedule(retrace, 0.7, 0.88), ...schedule(engraving, 0.88, 1)],
    uniforms: { bulges: BULGES },
  };
}

// --- Renacimiento: construcción legítima de Alberti (1435) y una esfera -------
// Proyección central: x = Vx + (X − Vx)·d/(d+z) · y = yh + (H − h)·d/(d+z), con H = yb − yh.
export function perspectiveDrawing() {
  const A = 4 / 3;
  const V = [A / 2, 0.4];
  const yh = V[1];
  const yb = 0.92;
  const dist = 1.1;
  const H = yb - yh;
  const x0 = 0.137;
  const w = (A - 2 * x0) / 8;
  const proj = (X, z, h = 0) => [V[0] + ((X - V[0]) * dist) / (dist + z), yh + ((H - h) * dist) / (dist + z)];
  const line = (a, b, press, width = 0.0035) => ({ pts: [a, b], w: width, press, jitter: 0.0006 });

  const horizon = [line([0.03, yh], [A - 0.03, yh], 0.32, 0.004)];
  const vp = [line([V[0] - 0.02, yh - 0.02], [V[0] + 0.02, yh + 0.02], 0.5), line([V[0] - 0.02, yh + 0.02], [V[0] + 0.02, yh - 0.02], 0.5)];
  const ground = [line([x0, yb], [x0 + 8 * w, yb], 0.55, 0.005)];
  const orthogonals = Array.from({ length: 9 }, (_, i) => line([x0 + i * w, yb], V, 0.3));
  const transversals = Array.from({ length: 8 }, (_, k) => line(proj(x0, (k + 1) * w), proj(x0 + 8 * w, (k + 1) * w), 0.42));
  const diagonal = [line([x0, yb], proj(x0 + 8 * w, 8 * w), 0.28)];
  const edges = [
    line([x0, yb], proj(x0, 8 * w), 0.75, 0.005),
    line([x0 + 8 * w, yb], proj(x0 + 8 * w, 8 * w), 0.75, 0.005),
    line(proj(x0, 8 * w), proj(x0 + 8 * w, 8 * w), 0.75, 0.005),
  ];

  // Esfera apoyada en el suelo, tres baldosas al fondo
  const zs = 3 * w;
  const R = 0.9 * w;
  const [cx] = proj(x0 + 5 * w, zs);
  const cy = proj(0, zs, R)[1];
  const r = (R * dist) / (dist + zs);
  const circle = (from, to, press, width, jitter) => ({
    pts: Array.from({ length: 65 }, (_, k) => {
      const a = from + ((to - from) * k) / 64;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }),
    w: width,
    press,
    jitter,
  });
  const sphere = [circle(-Math.PI * 0.6, Math.PI * 1.4, 0.8, 0.006, 0.0015)];
  const accent = [circle(-0.2, Math.PI * 0.9, 1, 0.008, 0.002)]; // el lado en sombra, repasado

  return {
    aspect: A,
    margin: 0.92,
    strokes: [
      ...schedule(horizon, 0, 0.05),
      ...schedule(vp, 0.05, 0.07),
      ...schedule(ground, 0.07, 0.1),
      ...schedule(orthogonals, 0.1, 0.32),
      ...schedule(transversals, 0.32, 0.52),
      ...schedule(diagonal, 0.52, 0.57),
      ...schedule(edges, 0.57, 0.64),
      ...schedule(sphere, 0.66, 0.84),
      ...schedule(accent, 0.86, 1),
    ],
    uniforms: { persp: [V[0], yh, yb, dist], tile: [x0, w], sphere: [cx, cy, r] },
  };
}
