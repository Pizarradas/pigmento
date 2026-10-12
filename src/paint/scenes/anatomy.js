// Escena · anatomía de un cuadro en isometría real (SYX: isometric/01-fundamentos/matematicas.md)
//   mundo → pantalla: sx = (x − y)·cos 30°·U · sy = ((x + y)/2 − z)·U  (y de pantalla hacia abajo)
// Ocho losas: primero se encajan a carboncillo (aristas), después se pintan una a una,
// de la madera al barniz, y al final la pila se cierra. Los grosores están exagerados.

import { createProgram } from '../gl.js';
import common from '../glsl/common.glsl?raw';
import vert from '../glsl/anatomy.vert?raw';
import frag from '../glsl/anatomy.frag?raw';
import strokeVert from '../glsl/charcoal-stroke.vert?raw';
import strokeFrag from '../glsl/anatomy-stroke.frag?raw';
import { buildGeometry } from './charcoal.js';

const COS30 = 0.8660254;
const W = 1; // ancho del cuadro (x)
const D = 0.8; // fondo (y): proporción 5:4
const BAR = 0.09; // listón del bastidor
const FRAME_H = 0.07;
const SKIN = 0.014; // grosor de cada capa sobre el bastidor (exagerado)
const GAP = 0.13; // separación entre capas con la pila abierta
export const LAYERS = 8;

// Cajas de una pila: { x0, y0, x1, y1, z0, z1, layer, swap } (swap: veta a lo largo de y)
function stack(explode, focus, amount = 1) {
  const lift = (i) => Math.exp(-((focus - i) ** 2) * 6) * 0.07 * amount * (focus >= 0 ? 1 : 0);
  const boxes = [];
  const z0 = lift(0);
  boxes.push(
    { x0: 0, y0: 0, x1: W, y1: BAR, layer: 0 },
    { x0: 0, y0: D - BAR, x1: W, y1: D, layer: 0 },
    { x0: 0, y0: BAR, x1: BAR, y1: D - BAR, layer: 0, swap: true },
    { x0: W - BAR, y0: BAR, x1: W, y1: D - BAR, layer: 0, swap: true },
    { x0: W / 2 - BAR / 2, y0: BAR, x1: W / 2 + BAR / 2, y1: D - BAR, layer: 0, swap: true },
  );
  boxes.forEach((b) => Object.assign(b, { z0, z1: z0 + FRAME_H }));
  for (let i = 1; i < LAYERS; i++) {
    const base = FRAME_H + (i - 1) * SKIN + explode * GAP * i + lift(i);
    boxes.push({ x0: 0, y0: 0, x1: W, y1: D, z0: base, z1: base + SKIN, layer: i });
  }
  return boxes;
}

// Aristas visibles de una caja vista desde +x +y: las cuatro de arriba, tres verticales y dos de la base
function edgesOf(b) {
  const top = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  const e = [];
  for (let k = 0; k < 4; k++) e.push([[...top[k], b.z1], [...top[(k + 1) % 4], b.z1]]);
  for (const [x, y] of [[b.x0, b.y1], [b.x1, b.y1], [b.x1, b.y0]]) e.push([[x, y, b.z1], [x, y, b.z0]]);
  e.push([[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0]], [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0]]);
  return e;
}

export class AnatomyScene {
  constructor() {
    this.name = 'anatomy';
    this.params = { explode: 1, draw: 0, f0: 0, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0, focus: -1, sheen: 0, lines: 1, fade: 1 };
    this.ink = [0.15, 0.13, 0.12];
    this.vertCount = 0;
    this.hover = { layer: -1, on: 0 }; // capa señalada en la lista o en su número
    this.strokeKey = '';
  }

  // Foco efectivo: la capa señalada manda sobre la del scroll, y se levanta más
  focusNow() {
    const h = this.hover;
    if (h.on > 0.001 && h.layer >= 0) return { focus: h.layer, amount: 1 + h.on * 1.4 };
    return { focus: this.params.focus, amount: 1 };
  }

  fills() {
    const p = this.params;
    return [p.f0, p.f1, p.f2, p.f3, p.f4, p.f5, p.f6, p.f7];
  }

  key() {
    const p = this.params;
    return `${p.explode.toFixed(4)},${p.draw.toFixed(4)},${this.fills().map((f) => f.toFixed(3)).join(',')},${p.focus.toFixed(3)},${p.sheen.toFixed(3)},${p.lines.toFixed(3)},${p.fade.toFixed(3)},${this.ink.join(',')},${this.hover.layer},${this.hover.on.toFixed(3)}`;
  }

  // La tinta del boceto es la de la página: se lee de SYX en cada cambio de tema
  setInk(rgb) {
    this.ink = rgb;
  }

  init(gl) {
    this.prog = createProgram(gl, vert, `${common}\n${frag}`);
    this.stroke = createProgram(gl, strokeVert, `${common}\n${strokeFrag}`);
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    this.svao = gl.createVertexArray();
    this.svbo = gl.createBuffer();
    this.sibo = gl.createBuffer();
    gl.bindVertexArray(this.svao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.svbo);
    const sstride = 10 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, sstride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, sstride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, sstride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, sstride, 32);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sibo);
    gl.bindVertexArray(null);
    this.strokeKey = '';
  }

  // Escala y origen fijos: se calculan con la pila abierta del todo, para que no haya saltos
  fit(w, h) {
    const boxes = stack(1, -1);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const b of boxes) {
      for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) {
        for (const z of [b.z0, b.z1 + 0.07]) {
          const sx = (x - y) * COS30;
          const sy = (x + y) * 0.5 - z;
          minX = Math.min(minX, sx);
          maxX = Math.max(maxX, sx);
          minY = Math.min(minY, sy);
          maxY = Math.max(maxY, sy);
        }
      }
    }
    // Hueco a la derecha para las etiquetas numeradas (48 px)
    const U = Math.min((w - 48) / (maxX - minX), h / (maxY - minY)) * 0.9;
    const ox = (w - 48 - (maxX - minX) * U) / 2 - minX * U;
    const oy = (h - (maxY - minY) * U) / 2 - minY * U;
    return { U, ox, oy };
  }

  project(x, y, z, f) {
    return [f.ox + (x - y) * COS30 * f.U, f.oy + ((x + y) * 0.5 - z) * f.U];
  }

  // Esquina derecha de la cara superior de cada capa con la pila abierta: ancla de su etiqueta
  anchors(w, h) {
    const f = this.fit(w, h);
    const boxes = stack(1, -1);
    const out = [this.project(W, 0, FRAME_H, f)];
    for (let i = 1; i < LAYERS; i++) {
      const b = boxes.find((bx) => bx.layer === i);
      out.push(this.project(W, 0, b.z1, f));
    }
    return out;
  }

  // Trazos del boceto, en px: primero las guías isométricas, luego cada capa de abajo arriba
  buildStrokes(boxes, f) {
    const P = (q) => this.project(q[0], q[1], q[2], f);
    const strokes = [];
    const guide = (a, b) => strokes.push({ pts: [P(a), P(b)], w: 1.4, press: 0.5, jitter: 0.3, jitterRef: 160, layer: 8, t0: 0, t1: 0 });
    const zTop = boxes.reduce((m, b) => Math.max(m, b.z1), 0);
    guide([W, D, -0.02], [W, D, zTop + 0.05]); // eje vertical por la esquina delantera
    guide([-0.15, D, 0], [W + 0.1, D, 0]); // ejes del suelo a 30°
    guide([W, -0.15, 0], [W, D + 0.1, 0]);
    const nGuides = strokes.length;
    for (let layer = 0; layer < LAYERS; layer++) {
      for (const b of boxes.filter((bx) => bx.layer === layer)) {
        for (const [a, c] of edgesOf(b)) strokes.push({ pts: [P(a), P(c)], w: 2.6, press: 0.95, jitter: 0.45, jitterRef: 160, layer, t0: 0, t1: 0 });
      }
    }
    // Tiempos: guías en el primer 12 %, después cada capa su tramo, en orden
    strokes.slice(0, nGuides).forEach((s, i) => Object.assign(s, { t0: (i / nGuides) * 0.12, t1: ((i + 1) / nGuides) * 0.12 }));
    for (let layer = 0; layer < LAYERS; layer++) {
      const own = strokes.filter((s) => s.layer === layer);
      const t0 = 0.12 + (layer / LAYERS) * 0.88;
      const span = 0.88 / LAYERS;
      own.forEach((s, i) => Object.assign(s, { t0: t0 + (i / own.length) * span, t1: t0 + ((i + 1) / own.length) * span }));
    }
    return buildGeometry(strokes, { step: 4, seedOf: (st, r) => st.layer + r * 0.99 });
  }

  render(gl, view) {
    const p = this.params;
    const f = this.fit(view.cssWidth, view.cssHeight);
    const fx = this.focusNow();
    const boxes = stack(p.explode, fx.focus, fx.amount);
    const fills = this.fills();

    // --- Caras pintadas, en orden de pintor ---
    const order = [...boxes].sort((a, b) => a.z0 - b.z0 || a.x0 + a.y0 - (b.x0 + b.y0));
    const data = [];
    const quad = (pts, uvs, face, layer, dim, fill) => {
      for (const k of [0, 1, 2, 0, 2, 3]) data.push(pts[k][0], pts[k][1], uvs[k][0], uvs[k][1], face, layer, dim, fill);
    };
    const P = (x, y, z) => this.project(x, y, z, f);
    const uv4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const s = 0.06;
    quad([P(s, s, 0), P(W + s, s, 0), P(W + s, D + s, 0), P(s, D + s, 0)], uv4, 3, 0, 1, Math.max(...fills));
    for (const b of order) {
      const dim = fx.focus >= 0 && Math.abs(fx.focus - b.layer) > 0.5 ? 0.82 : 1;
      const fill = fills[b.layer];
      const uvTop = b.swap ? [[0, 0], [0, 1], [1, 1], [1, 0]] : uv4;
      quad([P(b.x0, b.y1, b.z1), P(b.x1, b.y1, b.z1), P(b.x1, b.y1, b.z0), P(b.x0, b.y1, b.z0)], [[0, 1], [1, 1], [1, 1], [0, 1]], 1, b.layer, dim, fill);
      quad([P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x1, b.y1, b.z0), P(b.x1, b.y0, b.z0)], [[1, 0], [1, 1], [1, 1], [1, 0]], 2, b.layer, dim, fill);
      quad([P(b.x0, b.y0, b.z1), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)], uvTop, 0, b.layer, dim, fill);
    }
    const arr = new Float32Array(data);
    this.vertCount = arr.length / 8;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const { program, uniforms: u } = this.prog;
    gl.useProgram(program);
    gl.uniform2f(u.u_size, view.cssWidth, view.cssHeight);
    gl.uniform1f(u.u_sheen, p.sheen);
    gl.uniform1f(u.u_alpha, p.fade);
    gl.uniform1f(u.u_aspect, W / D);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);

    // --- Boceto a carbón encima: solo se rehace si la pila o el área se mueven ---
    if (p.draw > 0 && p.lines > 0) {
      const skey = `${p.explode.toFixed(4)},${fx.focus.toFixed(3)},${fx.amount.toFixed(3)},${view.cssWidth.toFixed(0)}x${view.cssHeight.toFixed(0)}`;
      if (skey !== this.strokeKey) {
        this.strokeKey = skey;
        const { verts, index } = this.buildStrokes(boxes, f);
        this.strokeIndexCount = index.length;
        gl.bindVertexArray(this.svao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.svbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.DYNAMIC_DRAW);
      }
      const su = this.stroke.uniforms;
      gl.useProgram(this.stroke.program);
      gl.uniform2f(su.u_size, view.cssWidth, view.cssHeight);
      gl.uniform3f(su.u_fit, 0, 0, 1); // los trazos ya vienen en px
      gl.uniform1f(su.u_draw, p.draw);
      gl.uniform3fv(su.u_ink, this.ink);
      gl.uniform1f(su.u_alpha, p.fade * p.lines);
      gl.uniform1fv(su['u_fill[0]'], fills);
      gl.bindVertexArray(this.svao);
      gl.drawElements(gl.TRIANGLES, this.strokeIndexCount, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}
