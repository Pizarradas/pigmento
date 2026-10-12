// Capítulo 6 · Pop y hard-edge
// Motion Spec: qué cambia → capas opacas, cinta, retirada y registro de la serigrafía
// cómo → scrub en pasos secos y cortados · qué lo activa → el scroll
// para qué → mostrar la pintura como proceso industrial: capa, máscara, registro.
import { pinnedChapter, live, stageAt } from '../chapter.js';

const STAGES = [
  [0, 'c6.s.roller'],
  [2, 'c6.s.tape'],
  [4, 'c6.s.red'],
  [6, 'c6.s.peel'],
  [8, 'c6.s.disc'],
  [9, 'c6.s.print'],
  [9.8, 'c6.s.register'],
];

export function pop({ section, scene, mm, motion }) {
  const write = live(section);
  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    final: { paint1: 1, tape: 1, paint2: 1, peel: 1, disc: 1, print: 1, regX: 0, regY: 0 },
    build: (tl, p) => {
      tl.to(p, { paint1: 1, duration: 2, ease: 'power1.inOut' }, 0)
        .to(p, { tape: 1, duration: 2 }, 2)
        .to(p, { paint2: 1, duration: 2, ease: 'power1.inOut' }, 4)
        .to(p, { peel: 1, duration: 2, ease: 'power2.inOut' }, 6)
        .to(p, { disc: 1, duration: 1.2, ease: 'power2.inOut' }, 8)
        .to(p, { print: 1, duration: 0.5 }, 9)
        .to(p, { regX: 0, regY: 0, duration: 0.8, ease: 'back.out(2.5)' }, 9.4);
    },
    onProgress: (time) => {
      const p = scene.params;
      write('stage', stageAt(STAGES, time));
      // El acrílico seca al tacto en minutos: cada capa nueva va sobre seco
      const layers = [p.paint1, p.paint2, p.disc, p.print].filter((v) => v > 0.98).length;
      write('layers', 'live.of', { n: layers, total: 4 });
    },
  });
}
