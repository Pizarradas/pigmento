// Escena · medios secos (carboncillo y ocre). Dos variantes:
//   'cueva'        Prehistoria: bisonte a carbón sobre roca, ocre soplado, luz de antorcha
//   'perspectiva'  Renacimiento: construcción de Alberti, esfera con difumino y tiza
import { createProgram, FULLSCREEN_VERTEX, drawFullscreen } from '../gl.js';
import common from '../glsl/common.glsl?raw';
import supportFrag from '../glsl/charcoal-support.frag?raw';
import strokeVert from '../glsl/charcoal-stroke.vert?raw';
import strokeFrag from '../glsl/charcoal-stroke.frag?raw';
import { caveDrawing, perspectiveDrawing } from './charcoal-drawings.js';
import { BISON_W, BISON_H, SILHOUETTE, FAR_LEGS, BLACK, SHADE } from './bison.js';

// Máscara del bisonte en Canvas 2D: R ocre · G negro · B sombreado.
// El desenfoque da el paso suave del ocre al negro, como el pigmento soplado.
export function bisonMask(gl) {
  const K = 5; // 1000 × 600 px
  const canvas = document.createElement('canvas');
  canvas.width = BISON_W * K;
  canvas.height = BISON_H * K;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(K, K);
  ctx.globalCompositeOperation = 'lighter';
  const fill = (paths, color, blur) => {
    ctx.filter = blur ? `blur(${blur}px)` : 'none';
    ctx.fillStyle = color;
    paths.forEach((d) => ctx.fill(new Path2D(d)));
  };
  fill([SILHOUETTE], '#ff0000', 0.6);
  fill(FAR_LEGS, '#c80000', 0.6);
  fill(FAR_LEGS, '#000050', 1.5); // las patas lejanas, algo en sombra
  fill(BLACK, '#00ff00', 1.4);
  fill(SHADE, '#0000ff', 4);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
import { PREHISTORIA, RENACIMIENTO } from '../palettes.js';
import { setPointerUniform } from '../../motion/pointer.js';

// Semilla fija: el pulso de la mano es el mismo en cada carga
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Densifica cada trazo, le añade el temblor de la mano y lo convierte en cinta
// step: paso de remuestreo en las unidades del trazo · seedOf: semilla de cada trazo
export function buildGeometry(strokes, { step = 0.004, seedOf } = {}) {
  const rand = mulberry32(36000);
  const verts = [];
  const index = [];
  for (const st of strokes) {
    // remuestreo a paso fijo
    const dense = [];
    for (let k = 0; k < st.pts.length - 1; k++) {
      const a = st.pts[k];
      const b = st.pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < n; j++) dense.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
    }
    dense.push(st.pts.at(-1));
    // temblor de baja frecuencia, perpendicular al trazo
    const phase = rand() * 100;
    const freq = 3 + rand() * 4;
    const seed = seedOf ? seedOf(st, rand()) : rand() + (st.engrave ? 2 : 0); // > 1,5: grabado, no carbón
    let length = 0;
    const lens = dense.map((p, k) => (k === 0 ? 0 : (length += Math.hypot(p[0] - dense[k - 1][0], p[1] - dense[k - 1][1]))));
    const base = verts.length / 10;
    dense.forEach((p, k) => {
      const prev = dense[Math.max(0, k - 1)];
      const next = dense[Math.min(dense.length - 1, k + 1)];
      let dx = next[0] - prev[0];
      let dy = next[1] - prev[1];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const s = length > 0 ? lens[k] / length : 0;
      // En trazos cortos el pulso se nota menos: el temblor escala con la longitud
      const wob = Math.sin(s * freq * 6.28 + phase) * st.jitter * Math.min(1, length / (st.jitterRef ?? 0.25));
      const x = p[0] - dy * wob;
      const y = p[1] + dx * wob;
      const t = st.t0 + (st.t1 - st.t0) * s;
      for (const side of [-1, 1]) verts.push(x, y, dx, dy, side, t, s, st.w, st.press, seed);
    });
    for (let k = 0; k < dense.length - 1; k++) {
      const i = base + k * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  return { verts: new Float32Array(verts), index: new Uint32Array(index) };
}

export class CharcoalScene {
  constructor(variant) {
    this.variant = variant;
    this.name = `charcoal-${variant}`;
    this.drawing = variant === 'cueva' ? caveDrawing() : perspectiveDrawing();
    this.palette = variant === 'cueva' ? PREHISTORIA : RENACIMIENTO;
    this.params =
      variant === 'cueva'
        ? { draw: 0, torch: 0, torchX: -0.3, flicker: 0, ochre: 0, black: 0, shade: 0, fade: 1 }
        : { draw: 0, tiles: 0, tone: 0, chalk: 0, fade: 1 };
    this.strokeCount = this.drawing.strokes.length;
  }

  key() {
    // GSAP guarda su caché (_gsap) en el propio objeto: solo cuentan los números
    return Object.values(this.params)
      .filter((v) => typeof v === 'number')
      .map((v) => v.toFixed(4))
      .join(',');
  }

  init(gl) {
    this.support = createProgram(gl, FULLSCREEN_VERTEX, `${common}\n${supportFrag}`);
    if (this.variant === 'cueva') this.mask = bisonMask(gl);
    this.stroke = createProgram(gl, strokeVert, `${common}\n${strokeFrag}`);
    const { verts, index } = buildGeometry(this.drawing.strokes);
    this.indexCount = index.length;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const stride = 10 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  // Encaja el dibujo en el área, centrado, con su margen
  fit(w, h) {
    const { aspect, margin } = this.drawing;
    const scale = Math.min(w / aspect, h) * margin;
    return [(w - aspect * scale) / 2, (h - scale) / 2, scale];
  }

  // Trazos ya hechos, para la cartela
  drawnStrokes() {
    return this.drawing.strokes.filter((s) => s.t1 <= this.params.draw + 1e-4).length;
  }

  render(gl, view) {
    const p = this.params;
    const pal = this.palette;
    const fit = this.fit(view.cssWidth, view.cssHeight);
    const { program, uniforms: u } = this.support;

    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniform2f(u.u_size, view.cssWidth, view.cssHeight);
    gl.uniform3fv(u.u_fit, fit);
    gl.uniform1i(u.u_variant, this.variant === 'cueva' ? 0 : 1);
    gl.uniform1f(u.u_alpha, p.fade);
    setPointerUniform(gl, u.u_ptr, this);
    gl.uniform1f(u.u_live, this.pointer ? this.pointer.time : 0);
    gl.uniform3fv(u.u_ground, pal.ground);
    gl.uniform3fv(u.u_charcoal, pal.charcoal);
    gl.uniform3fv(u.u_ochreColor, pal.ochre);
    gl.uniform3fv(u.u_chalkColor, pal.chalk);
    const un = this.drawing.uniforms;
    if (this.variant === 'cueva') {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.mask);
      gl.uniform1i(u.u_mask, 0);
      gl.uniform1f(u.u_aspect, this.drawing.aspect);
      un.bulges.forEach((b, i) => gl.uniform4fv(u[`u_bulge${i}`], b));
      gl.uniform1f(u.u_torch, p.torch);
      gl.uniform1f(u.u_torchX, p.torchX);
      gl.uniform1f(u.u_flicker, p.flicker);
      gl.uniform1f(u.u_ochre, p.ochre);
      gl.uniform1f(u.u_black, p.black);
      gl.uniform1f(u.u_shade, p.shade);
    } else {
      gl.uniform4fv(u.u_persp, un.persp);
      gl.uniform2fv(u.u_tile, un.tile);
      gl.uniform3fv(u.u_sphere, un.sphere);
      gl.uniform1f(u.u_tiles, p.tiles);
      gl.uniform1f(u.u_tone, p.tone);
      gl.uniform1f(u.u_chalk, p.chalk);
    }
    drawFullscreen(gl);

    if (p.draw <= 0) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const s = this.stroke;
    gl.useProgram(s.program);
    gl.uniform2f(s.uniforms.u_size, view.cssWidth, view.cssHeight);
    gl.uniform3fv(s.uniforms.u_fit, fit);
    gl.uniform1f(s.uniforms.u_draw, p.draw);
    gl.uniform1i(s.uniforms.u_variant, this.variant === 'cueva' ? 0 : 1);
    gl.uniform3fv(s.uniforms.u_charcoal, pal.charcoal);
    gl.uniform1f(s.uniforms.u_alpha, p.fade);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}
