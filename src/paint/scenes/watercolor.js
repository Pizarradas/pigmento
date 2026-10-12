// Escena · acuarela (capítulo 3). GSAP anima `params`; el motor llama a render().
import { setPointerUniform } from '../../motion/pointer.js';
import spectral from 'spectral.js';
import { createProgram, FULLSCREEN_VERTEX, drawFullscreen } from '../gl.js';
import common from '../glsl/common.glsl?raw';
import spectralGlsl from '../glsl/spectral.glsl?raw';
import fragment from '../glsl/watercolor.frag?raw';
import { ROMANTICISMO as P } from '../palettes.js';

// El reflejo del sol: aureolina y cadmio mezclados como pigmento, una vez, en CPU.
function reflectColor() {
  const to = (c) => new spectral.Color(`rgb(${c.map((v) => Math.round(v * 255)).join(',')})`);
  const mixed = spectral.mix([to(P.aureolin), 0.65], [to(P.cadmio), 0.35]);
  return mixed.sRGB.map((v) => v / 255);
}

export class WatercolorScene {
  constructor() {
    this.name = 'watercolor';
    this.params = { sky: 0, sun: 0, cloud: 0, bloom: 0, sea: 0, reflect: 0, ship: 0, wet: 1, fade: 1 };
    this.reflect = reflectColor();
  }

  key() {
    const p = this.params;
    return [p.sky, p.sun, p.cloud, p.bloom, p.sea, p.reflect, p.ship, p.wet, p.fade].map((v) => v.toFixed(4)).join(',');
  }

  init(gl) {
    this.gl = gl;
    this.prog = createProgram(gl, FULLSCREEN_VERTEX, `${common}\n${spectralGlsl}\n${fragment}`);
  }

  render(gl, view) {
    const { program, uniforms: u } = this.prog;
    const p = this.params;
    gl.useProgram(program);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.u_size, view.cssWidth, view.cssHeight);
    gl.uniform1f(u.u_sky, p.sky);
    gl.uniform1f(u.u_sun, p.sun);
    gl.uniform1f(u.u_cloud, p.cloud);
    gl.uniform1f(u.u_bloom, p.bloom);
    gl.uniform1f(u.u_sea, p.sea);
    gl.uniform1f(u.u_reflect, p.reflect);
    gl.uniform1f(u.u_ship, p.ship);
    gl.uniform1f(u.u_wet, p.wet);
    gl.uniform1i(u.u_mix, view.quality.mix);
    gl.uniform1i(u.u_octaves, view.quality.octaves);
    gl.uniform3fv(u.u_paper, P.paper);
    gl.uniform3fv(u.u_aureolin, P.aureolin);
    gl.uniform3fv(u.u_cadmio, P.cadmio);
    gl.uniform3fv(u.u_tinta, P.tinta);
    gl.uniform3fv(u.u_ultramar, P.ultramar);
    gl.uniform3fv(u.u_siena, P.siena);
    gl.uniform3fv(u.u_reflectColor, this.reflect);
    gl.uniform1f(u.u_alpha, p.fade);
    setPointerUniform(gl, u.u_ptr, this);
    drawFullscreen(gl);
  }
}
