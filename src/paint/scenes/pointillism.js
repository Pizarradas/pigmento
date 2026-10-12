// Escena · puntillismo (capítulo 5).
// Cada toque recibe UN pigmento puro de la paleta (ver pointillism-data.js).
// Los toques se construyen en un Worker; mientras llegan, se pinta solo el pliego.

import { createProgram, FULLSCREEN_VERTEX, drawFullscreen } from '../gl.js';
import common from '../glsl/common.glsl?raw';
import sheetFrag from '../glsl/sheet.frag?raw';
import pointsVert from '../glsl/points.vert?raw';
import pointsFrag from '../glsl/points.frag?raw';
import { PUNTILLISMO_PAPER } from '../palettes.js';
import { SUN, buildPoints } from './pointillism-data.js';
import BuildWorker from './pointillism.worker.js?worker&inline';

export class PointillismScene {
  constructor() {
    this.name = 'pointillism';
    this.params = { gather: 0, zoom: 1, fade: 1 };
    this.focus = [SUN[0], 0.5];
    this.count = 0;
    this.spacing = 4;
    this.requested = '';
    this.requestId = 0;
    try {
      this.worker = new BuildWorker();
      this.worker.onmessage = ({ data }) => {
        if (data.id === this.requestId) this.upload(data);
      };
    } catch {
      this.worker = null; // sin Workers: se construye en el hilo principal
    }
  }

  key() {
    const p = this.params;
    return `${p.gather.toFixed(4)},${p.zoom.toFixed(4)},${p.fade.toFixed(3)},${this.count}`;
  }

  init(gl) {
    this.gl = gl;
    this.sheet = createProgram(gl, FULLSCREEN_VERTEX, `${common}\n${sheetFrag}`);
    this.points = createProgram(gl, pointsVert, pointsFrag);
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
    this.maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
    this.count = 0;
    this.requested = '';
  }

  prepare(rect) {
    if (rect.width > 2 && rect.height > 2) this.request(rect.width, rect.height);
  }

  // Se pide en cuanto se conoce el tamaño del área; solo se reconstruye si cambia más de 40 px.
  request(cssWidth, cssHeight) {
    const size = `${Math.round(cssWidth / 40)}x${Math.round(cssHeight / 40)}`;
    if (size === this.requested) return;
    this.requested = size;
    this.requestId += 1;
    if (this.worker) {
      this.worker.postMessage({ id: this.requestId, width: cssWidth, height: cssHeight });
    } else {
      this.upload({ ...buildPoints(cssWidth, cssHeight) });
    }
  }

  upload({ data, count, spacing }) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 28);
    gl.bindVertexArray(null);
    this.count = count;
    this.spacing = spacing;
  }

  render(gl, view) {
    this.request(view.cssWidth, view.cssHeight);

    gl.disable(gl.BLEND);
    gl.useProgram(this.sheet.program);
    gl.uniform2f(this.sheet.uniforms.u_size, view.cssWidth, view.cssHeight);
    gl.uniform3fv(this.sheet.uniforms.u_paper, PUNTILLISMO_PAPER);
    gl.uniform1f(this.sheet.uniforms.u_alpha, this.params.fade);
    drawFullscreen(gl);
    if (!this.count) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const { program, uniforms: u } = this.points;
    gl.useProgram(program);
    gl.uniform1f(u.u_gather, this.params.gather);
    gl.uniform1f(u.u_zoom, this.params.zoom);
    gl.uniform2fv(u.u_focus, this.focus);
    gl.uniform1f(u.u_dot, this.spacing * 1.25 * view.dpr);
    gl.uniform1f(u.u_maxPoint, this.maxPoint);
    gl.uniform1f(u.u_alpha, this.params.fade);
    const ptr = this.pointer;
    gl.uniform3f(u.u_lens, ptr ? ptr.x / view.cssWidth : 0.5, ptr ? 1 - ptr.y / view.cssHeight : 0.5, ptr ? ptr.on : 0);
    gl.uniform1f(u.u_aspect, view.cssWidth / view.cssHeight);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}
