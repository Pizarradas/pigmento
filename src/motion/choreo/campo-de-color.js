// Capítulo 5 · Campo de color
// Motion Spec: qué cambia → cuatro vertidos y la inclinación del bastidor
// cómo → scrub; la inclinación gira mientras la pintura corre · qué lo activa → el scroll
// para qué → mostrar que la forma la decide el líquido y la pendiente, no el pincel.
import { pinnedChapter, live, stageAt } from '../chapter.js';

const STAGES = [
  [0, 'c5.s.pour1'],
  [2, 'c5.s.tilt'],
  [4, 'c5.s.pour23'],
  [5.5, 'c5.s.pour4'],
  [7.5, 'c5.s.dry'],
];

export function campoDeColor({ section, scene, mm, motion }) {
  const write = live(section);
  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    final: { p0: 1, p1: 1, p2: 1, p3: 1, tiltAngle: 2.2, tiltAmount: 1, dry: 1 },
    build: (tl, p) => {
      tl.to(p, { p0: 1, duration: 3, ease: 'power2.out' }, 0)
        .to(p, { tiltAmount: 1, duration: 3, ease: 'power1.inOut' }, 1.5)
        .to(p, { tiltAngle: 2.2, duration: 7.5, ease: 'power1.inOut' }, 1.5)
        .to(p, { p1: 1, duration: 3, ease: 'power2.out' }, 2.4)
        .to(p, { p2: 1, duration: 2.5, ease: 'power2.out' }, 4)
        .to(p, { p3: 1, duration: 3, ease: 'power2.out' }, 5.5)
        .to(p, { dry: 1, duration: 2 }, 7.8);
    },
    onProgress: (time) => {
      const p = scene.params;
      write('stage', stageAt(STAGES, time));
      // Inclinación simulada: de 0 a 12° sobre la horizontal
      write('tilt', `${Math.round(p.tiltAmount * 12)}°`);
    },
  });
}
