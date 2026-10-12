// Puntero sobre el lienzo: cada capítulo lo usa como su herramienta
// (antorcha, lámpara, esponja, lupa, bastidor, pantalla de serigrafía, lente latente).
// scene.pointer = { x, y, on, time }: x/y en px CSS del lienzo (y hacia abajo), on 0–1.
// El motor lo suma a la clave de dibujo, así que solo se repinta cuando el puntero cambia.
// En táctil: el dedo enciende la herramienta y se apaga sola al soltar.
import { gsap } from 'gsap';

export function attachPointer(scene, lienzo, { live = false } = {}) {
  const ptr = { x: 0, y: 0, on: 0, time: 0 };
  scene.pointer = ptr;
  const toX = gsap.quickTo(ptr, 'x', { duration: 0.35, ease: 'power3' });
  const toY = gsap.quickTo(ptr, 'y', { duration: 0.35, ease: 'power3' });
  let inside = false;

  const place = (e, jump) => {
    const r = lienzo.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (jump) {
      gsap.set(ptr, { x, y });
      toX(x);
      toY(y);
    } else {
      toX(x);
      toY(y);
    }
  };
  lienzo.dataset.tool = '';
  const light = (on, delay = 0) => {
    lienzo.classList.toggle('is-using', on > 0);
    return gsap.to(ptr, { on, duration: on ? 0.45 : 0.9, delay, ease: on ? 'power2.out' : 'power2.inOut', overwrite: 'auto' });
  };

  lienzo.addEventListener('pointerenter', (e) => {
    inside = true;
    place(e, ptr.on < 0.05);
    if (e.pointerType === 'mouse') light(1);
  });
  lienzo.addEventListener('pointermove', (e) => place(e, false));
  lienzo.addEventListener('pointerdown', (e) => {
    place(e, ptr.on < 0.05);
    light(1);
  });
  const release = (e) => {
    if (e.pointerType !== 'mouse') light(0, 0.8);
  };
  lienzo.addEventListener('pointerup', release);
  lienzo.addEventListener('pointercancel', release);
  lienzo.addEventListener('pointerleave', () => {
    inside = false;
    light(0);
  });

  // Escenas «vivas» (la llama de la antorcha): el tiempo corre solo mientras la herramienta está encendida
  if (live) {
    gsap.ticker.add((_, dt) => {
      if (ptr.on > 0.001) ptr.time += Math.min(dt, 100) / 1000;
    });
  }
  return { get inside() { return inside; } };
}

// Clave del puntero para el motor: cambia solo si cambia lo que se ve
export const pointerKey = (p) => (p ? `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.on.toFixed(3)},${p.time.toFixed(2)}` : '');

// Uniforme estándar u_ptr = (x, y, on) en px CSS, y hacia abajo
export function setPointerUniform(gl, loc, scene) {
  const p = scene.pointer;
  if (loc) gl.uniform3f(loc, p ? p.x : 0, p ? p.y : 0, p ? p.on : 0);
}
