// Capítulo 4 · Puntillismo
// Motion Spec: qué cambia → la posición de cada toque y la distancia de la mirada
// cómo → reunión escalonada por toque, acercamiento, alejamiento · qué lo activa → el scroll
// para qué → comparación: el mismo cuadro de cerca (puntos) y de lejos (mezcla óptica).
import { pinnedChapter } from '../chapter.js';

const ZOOM_NEAR = 7; // de cerca: cada toque mide ~30 px
const ZOOM_FAR = 0.55; // de lejos: el ojo ya no separa los toques

export function puntillismo({ section, scene, mm, motion }) {
  const steps = [...section.querySelectorAll('.pigmento-steps__item')];
  const setStep = (index) => {
    steps.forEach((el, i) => {
      el.classList.toggle('is-active', index === -1 || i === index);
      if (i === index) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
  };
  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    length: '+=280%',
    final: { gather: 1, zoom: 1 },
    build: (tl, p) => {
      tl.to(p, { gather: 1, duration: 4.5 }, 0)
        .to(p, { zoom: ZOOM_NEAR, duration: 2.2, ease: 'power2.inOut' }, 5)
        .to(p, { zoom: ZOOM_FAR, duration: 2.4, ease: 'power2.inOut' }, 7.6);
    },
    onProgress: (time, reduced) => setStep(reduced ? -1 : time < 5 ? 0 : time < 7.6 ? 1 : 2),
  });
}
