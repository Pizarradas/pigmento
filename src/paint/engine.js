// Motor pictórico: un único contexto WebGL2 detrás de la página.
// Cada escena pinta solo el rectángulo de su área de la retícula (.pigmento-lienzo).
// GSAP anima los parámetros de cada escena; el motor los lee en cada tick.

import { gsap } from 'gsap';
import { pointerKey } from '../motion/pointer.js';

// Escalera de calidad (plan § Rendimiento). Se baja un peldaño si el frame medio
// supera el límite durante dos segundos seguidos; nunca se vuelve a subir en la sesión.
const LEVELS = [
  { name: 'completo', scale: 1, mix: 0, octaves: 4 },
  { name: 'medio', scale: 0.75, mix: 1, octaves: 4 },
  { name: 'ahorro', scale: 0.5, mix: 1, octaves: 2 },
];
const FRAME_BUDGET_MS = 20; // 16,7 ms + margen de jitter en pantallas de 60 Hz
const WINDOW_MS = 2000;
const MAX_DPR = 2;

export class PaintEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.scenes = [];
    // ?nivel=0|1|2 fija un peldaño (pruebas y comparación); sin él, la escalera es automática
    const forced = new URLSearchParams(location.search).get('nivel');
    this.fixedLevel = forced !== null && LEVELS[Number(forced)] ? Number(forced) : null;
    this.level = this.fixedLevel ?? 0;
    this.stats = { frames: [], worst: 0, avg: 0, cpu: 0, drawn: 0 };
    this.lastKey = '';
    this.windowStart = performance.now();
    this.windowFrames = [];

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.gl = gl;
    this.ok = Boolean(gl);
    if (!gl) return;

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.ok = false;
      document.documentElement.classList.add('is-no-webgl');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.ok = true;
      document.documentElement.classList.remove('is-no-webgl');
      this.scenes.forEach((entry) => entry.scene.init(this.gl, this));
      this.lastKey = '';
    });

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const entry = this.scenes.find((s) => s.element === e.target);
          if (entry) entry.visible = e.isIntersecting;
          // Una pantalla antes de verse, la escena prepara lo caro (los toques, en un Worker)
          if (entry && e.isIntersecting) entry.scene.prepare?.(e.boundingClientRect);
        });
        this.lastKey = '';
      },
      { rootMargin: '100% 0px' },
    );

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    this.resize();
  }

  get quality() {
    return LEVELS[this.level];
  }

  add(scene, element) {
    if (!this.ok) return;
    try {
      scene.init(this.gl, this);
    } catch (error) {
      console.error(error);
      document.documentElement.classList.add('is-no-webgl');
      this.ok = false;
      return;
    }
    this.scenes.push({ scene, element, visible: false });
    this.observer.observe(element);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * this.quality.scale;
    this.dpr = dpr;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.lastKey = '';
  }

  start() {
    if (!this.ok) return;
    this.tick = this.tick.bind(this);
    gsap.ticker.add(this.tick);
  }

  tick(time, deltaMs) {
    if (!this.ok) return;
    const t0 = performance.now();
    const gl = this.gl;
    const vh = window.innerHeight;

    // Clave de estado: si nada cambió (ni posición ni parámetros), no se pinta.
    const views = [];
    let key = `${this.canvas.width}x${this.canvas.height}|${this.level}`;
    for (const entry of this.scenes) {
      if (!entry.visible) continue;
      const r = entry.element.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || r.width < 2 || r.height < 2) continue;
      views.push({ entry, r });
      key += `|${entry.scene.name}:${r.left.toFixed(1)},${r.top.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}:${entry.scene.key()}|${pointerKey(entry.scene.pointer)}`;
    }

    const changed = key !== this.lastKey;
    if (changed) {
      this.lastKey = key;
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);

      for (const { entry, r } of views) {
        const x = Math.round(r.left * this.dpr);
        const y = Math.round((vh - r.bottom) * this.dpr);
        const w = Math.round(r.width * this.dpr);
        const h = Math.round(r.height * this.dpr);
        gl.viewport(x, y, w, h);
        gl.scissor(x, y, w, h);
        entry.scene.render(gl, {
          width: w,
          height: h,
          cssWidth: r.width,
          cssHeight: r.height,
          dpr: this.dpr,
          quality: this.quality,
        });
      }
      gl.disable(gl.SCISSOR_TEST);
      this.stats.drawn += 1;
      this.stats.cpu = performance.now() - t0;
    }

    this.measure(deltaMs, changed);
  }

  // Medición en el peor caso: media y peor frame de la ventana de 2 s.
  measure(deltaMs, active) {
    const now = performance.now();
    if (active && deltaMs > 0 && deltaMs < 250) this.windowFrames.push(deltaMs);
    if (now - this.windowStart < WINDOW_MS) return;

    const frames = this.windowFrames;
    if (frames.length > 20) {
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      this.stats.avg = avg;
      this.stats.worst = Math.max(...frames);
      if (this.fixedLevel === null && avg > FRAME_BUDGET_MS && this.level < LEVELS.length - 1) {
        this.level += 1;
        this.resize();
        this.scenes.forEach((entry) => entry.scene.onQuality?.(this.quality));
      }
    }
    this.windowFrames = [];
    this.windowStart = now;
  }

  describe() {
    const q = this.quality;
    const points = this.scenes.reduce((n, e) => n + (e.scene.count || 0), 0);
    return [
      `WebGL2 · nivel ${this.level} (${q.name}) · resolución ×${this.dpr.toFixed(2)}`,
      `mezcla ${q.mix === 0 ? 'espectral 38 bandas' : 'Kubelka-Munk 3 canales'}`,
      `frame medio ${this.stats.avg.toFixed(1)} ms · peor ${this.stats.worst.toFixed(1)} ms (2 s)`,
      `render CPU ${this.stats.cpu.toFixed(2)} ms · cuadros pintados ${this.stats.drawn}`,
      `puntos ${points.toLocaleString('es-ES')}`,
    ].join('\n');
  }
}
