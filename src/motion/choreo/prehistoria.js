// Capítulo 1 · Prehistoria
// Motion Spec: qué cambia → la luz, el contorno a carbón y el ocre · cómo → scrub
// qué lo activa → el scroll con el capítulo fijado · para qué → revelado: la antorcha
// descubre la pared y la mano dibuja sobre ella.
import { pinnedChapter, live } from '../chapter.js';

export function prehistoria({ section, scene, mm, motion }) {
  const write = live(section);
  const total = scene.strokeCount;
  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    length: '+=300%',
    final: { draw: 1, torch: 1, torchX: 1.15, flicker: 0, ochre: 1, black: 1, shade: 1 },
    build: (tl, p) => {
      // La antorcha entra, recorre la pared y descubre sus lomas antes de que haya pintura
      tl.to(p, { torch: 1, duration: 1.6, ease: 'power2.out' }, 0)
        .fromTo(p, { torchX: -0.3 }, { torchX: 1.5, duration: 3, ease: 'power1.inOut' }, 0)
        .to(p, { torchX: 0.95, duration: 2, ease: 'power1.inOut' }, 3)
        .to(p, { flicker: 12, duration: 11 }, 0)
        .to(p, { draw: 1, duration: 3.6 }, 2.6)
        .to(p, { ochre: 1, duration: 2.6, ease: 'power1.inOut' }, 6)
        .to(p, { black: 1, duration: 2, ease: 'power1.inOut' }, 8)
        .to(p, { shade: 1, duration: 1.4 }, 9.4)
        .to(p, { torchX: 1.15, duration: 2, ease: 'power1.inOut' }, 9);
    },
    onProgress: (time) => {
      const p = scene.params;
      const label =
        p.shade > 0.02
          ? 'c1.s.shade'
          : p.black > 0.02
            ? 'c1.s.black'
            : p.ochre > 0.02
              ? 'c1.s.ochre'
              : p.draw > 0.88
                ? 'c1.s.engrave'
                : p.draw > 0.001
                  ? 'c1.s.contour'
                  : time > 1.5
                    ? 'c1.s.bulges'
                    : 'c1.s.torch';
      write('stage', label);
      write('strokes', 'live.of', { n: scene.drawnStrokes(), total: total });
    },
  });
}
