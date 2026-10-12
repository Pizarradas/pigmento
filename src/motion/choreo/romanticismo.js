// Capítulo 3 · Romanticismo
// Motion Spec: qué cambia → cinco aguadas, la humedad del papel y el eje SOFT del titular
// cómo → scrub 0,6 con curva «pincelada» · qué lo activa → el scroll, capítulo fijado
// para qué → revelado: la luz disuelve la forma mientras se lee.
import { gsap } from 'gsap';
import { pinnedChapter, live, stageAt } from '../chapter.js';
import { PINCELADA } from '../tokens.js';

const STAGES = [
  [0, 'c3.s.sky'],
  [1.2, 'c3.s.wet'],
  [4.2, 'c3.s.sea'],
  [6.2, 'c3.s.drying'],
  [9.8, 'c3.s.dry'],
];

export function romanticismo({ section, scene, mm, motion }) {
  const write = live(section);
  const title = section.querySelector('.pigmento-chapter__title');
  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    length: '+=260%',
    final: { sky: 1, sun: 1, cloud: 1, bloom: 1, sea: 1, reflect: 1, ship: 1, wet: 0 },
    build: (tl, p) => {
      gsap.set(title, { '--pigmento-soft': 0 });
      tl.to(p, { sky: 1, duration: 3.5, ease: PINCELADA }, 0)
        .to(p, { sun: 1, duration: 3, ease: PINCELADA }, 1.2)
        .to(p, { cloud: 1, duration: 3, ease: PINCELADA }, 2.8)
        .to(p, { bloom: 1, duration: 2.2, ease: 'power2.out' }, 3.4)
        .to(p, { sea: 1, duration: 3, ease: PINCELADA }, 4.2)
        .to(p, { reflect: 1, duration: 2.5, ease: PINCELADA }, 5.2)
        .to(p, { ship: 1, duration: 2, ease: PINCELADA }, 6.8)
        .to(p, { wet: 0, duration: 3.8, ease: 'power1.in' }, 6.2)
        .to(title, { '--pigmento-soft': 100, duration: 10 }, 0);
    },
    onProgress: (time, reduced) => {
      if (reduced) gsap.set(title, { '--pigmento-soft': 100 });
      write('stage', stageAt(STAGES, time));
      write('wet', `${Math.round(scene.params.wet * 100)} %`);
    },
  });
}
