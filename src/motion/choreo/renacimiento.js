// Capítulo 2 · Renacimiento
// Motion Spec: qué cambia → la construcción de Alberti, el embaldosado, el difumino
// y la tiza · cómo → scrub, en el orden real del método · para qué → explicar:
// el cuadro como ventana se construye antes de pintarse.
import { pinnedChapter, live, stageAt } from '../chapter.js';
import { PINCELADA } from '../tokens.js';

const STAGES = [
  [0, 'c2.s.horizon'],
  [0.07, 'c2.s.ground'],
  [0.1, 'c2.s.orthogonals'],
  [0.32, 'c2.s.transversals'],
  [0.52, 'c2.s.diagonal'],
  [0.57, 'c2.s.edges'],
  [0.66, 'c2.s.sphere'],
];

export function renacimiento({ section, scene, mm, motion }) {
  const write = live(section);
  const total = scene.strokeCount;
  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    final: { draw: 1, tiles: 1, tone: 1, chalk: 1 },
    build: (tl, p) => {
      tl.to(p, { draw: 1, duration: 6.5 }, 0)
        .to(p, { tiles: 1, duration: 2 }, 3.6)
        .to(p, { tone: 1, duration: 2.5, ease: PINCELADA }, 6.6)
        .to(p, { chalk: 1, duration: 1.2, ease: PINCELADA }, 8.8);
    },
    onProgress: () => {
      const p = scene.params;
      let label = stageAt(STAGES, p.draw);
      if (p.tone > 0.01) label = 'c2.s.tone';
      if (p.chalk > 0.01) label = 'c2.s.chalk';
      write('stage', label);
      write('strokes', 'live.of', { n: scene.drawnStrokes(), total: total });
    },
  });
}
