// Escenas de acrílico:
//   StainScene  Campo de color: acrílico diluido que tiñe algodón crudo
//   PopScene    Pop y hard-edge: acrílico opaco, cinta y serigrafía
import { createProgram, FULLSCREEN_VERTEX, drawFullscreen } from '../gl.js';
import common from '../glsl/common.glsl?raw';
import stainFrag from '../glsl/stain.frag?raw';
import popFrag from '../glsl/pop.frag?raw';
import { CAMPO_DE_COLOR, POP } from '../palettes.js';

// GSAP guarda su caché (_gsap) en el propio objeto: solo cuentan los números
const keyOf = (params) =>
  Object.values(params)
    .filter((v) => typeof v === 'number')
    .map((v) => v.toFixed(4))
    .join(',');

export class StainScene {
  constructor() {
    this.name = 'stain';
    this.params = { p0: 0, p1: 0, p2: 0, p3: 0, tiltAngle: -0.6, tiltAmount: 0, dry: 0, fade: 1 };
  }

  key() {
    return keyOf(this.params);
  }

  init(gl) {
    this.prog = createProgram(gl, FULLSCREEN_VERTEX, `${common}\n${stainFrag}`);
  }

  render(gl, view) {
    const p = this.params;
    const { program, uniforms: u } = this.prog;
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniform2f(u.u_size, view.cssWidth, view.cssHeight);
    gl.uniform4f(u.u_pour, p.p0, p.p1, p.p2, p.p3);
    // Con el puntero dentro, quien mira inclina el bastidor: la pintura corre hacia el cursor
    const ptr = this.pointer;
    const lean = ptr ? ptr.on : 0;
    const lx = ptr ? (ptr.x / view.cssWidth - 0.5) * 2 : 0;
    const ly = ptr ? (0.5 - ptr.y / view.cssHeight) * 2 : 0;
    gl.uniform2f(u.u_tilt, Math.cos(p.tiltAngle) * p.tiltAmount + lx * lean * 0.5, Math.sin(p.tiltAngle) * p.tiltAmount + ly * lean * 0.5);
    gl.uniform1f(u.u_dry, p.dry);
    gl.uniform1f(u.u_alpha, p.fade);
    gl.uniform3fv(u.u_canvas, CAMPO_DE_COLOR.canvas);
    CAMPO_DE_COLOR.stains.forEach((c, i) => gl.uniform3fv(u[`u_c${i}`], c));
    drawFullscreen(gl);
  }
}

export class PopScene {
  constructor() {
    this.name = 'pop';
    this.params = { paint1: 0, tape: 0, paint2: 0, peel: 0, disc: 0, print: 0, regX: 0.035, regY: -0.025, fade: 1 };
  }

  key() {
    return keyOf(this.params);
  }

  init(gl) {
    this.prog = createProgram(gl, FULLSCREEN_VERTEX, `${common}\n${popFrag}`);
  }

  render(gl, view) {
    const p = this.params;
    const { program, uniforms: u } = this.prog;
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniform2f(u.u_size, view.cssWidth, view.cssHeight);
    gl.uniform1f(u.u_paint1, p.paint1);
    gl.uniform1f(u.u_tape, p.tape);
    gl.uniform1f(u.u_paint2, p.paint2);
    gl.uniform1f(u.u_peel, p.peel);
    gl.uniform1f(u.u_disc, p.disc);
    gl.uniform1f(u.u_print, p.print);
    // La pantalla de serigrafía va con el puntero: el registro se desajusta y vuelve a encajar al salir
    const sp = this.pointer;
    const shift = sp ? sp.on * Math.max(p.print, 0.15) : 0;
    const sx = sp ? (sp.x / view.cssWidth - 0.5) * 0.06 : 0;
    const sy = sp ? (sp.y / view.cssHeight - 0.5) * 0.06 : 0;
    gl.uniform2f(u.u_reg, p.regX + sx * shift, p.regY + sy * shift);
    gl.uniform1f(u.u_alpha, p.fade);
    gl.uniform3fv(u.u_gesso, POP.gesso);
    gl.uniform3fv(u.u_yellow, POP.yellow);
    gl.uniform3fv(u.u_red, POP.red);
    gl.uniform3fv(u.u_blue, POP.blue);
    gl.uniform3fv(u.u_tapeColor, POP.tape);
    gl.uniform3fv(u.u_dots, POP.dots);
    drawFullscreen(gl);
  }
}
