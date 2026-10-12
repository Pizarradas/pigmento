// Coreografía común a todos los capítulos (patrón pinned-scrub de SYX).
//   escritorio → se fija el capítulo entero
//   móvil      → se lee el texto en flujo y se fija solo el escenario
//   reducido   → sin pin ni scrub: el cuadro aparece terminado, con un fundido
import { gsap } from 'gsap';
import { t, onLang } from '../i18n/i18n.js';

export function pinnedChapter({ section, scene, mm, motion, length = '+=240%', build, onProgress, final }) {
  const pin = section.querySelector('.pigmento-chapter__pin');
  const stage = section.querySelector('.pigmento-chapter__stage');
  const lienzo = section.querySelector('.pigmento-lienzo');
  const p = scene.params;
  const initial = { ...p };

  mm.add({ motion: '(prefers-reduced-motion: no-preference)', laptop: '(min-width: 64em)' }, (ctx) => {
    if (!ctx.conditions.motion) return undefined;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: ctx.conditions.laptop ? pin : stage,
        start: 'top top',
        end: length,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
      },
      // Las cifras de la cartela siguen al cuadro (con su retardo de scrub), no a la barra
      onUpdate: () => onProgress?.(tl.time(), false),
    });
    const cleanup = build(tl, p);

    // Entrada del texto antes de fijar: cascada de líneas, una vez
    gsap.from(section.querySelectorAll('.pigmento-chapter__text > *'), {
      autoAlpha: 0,
      y: 24,
      duration: motion.slow * 2,
      ease: 'power3.out',
      stagger: motion.fast / 2,
      scrollTrigger: { trigger: section, start: 'top 75%', once: true },
    });

    onProgress?.(0, false);
    return () => {
      cleanup?.();
      Object.assign(p, initial);
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    Object.assign(p, final);
    onProgress?.(Infinity, true);
    // El cuadro lo pinta el lienzo compartido: el fundido es un parámetro de la escena
    gsap.fromTo(
      p,
      { fade: 0 },
      { fade: 1, duration: motion.slow, ease: 'none', scrollTrigger: { trigger: lienzo, start: 'top 85%', once: true } },
    );
    return () => Object.assign(p, initial);
  });
}

// Escribe un valor en la cartela: <dd data-live="nombre">.
// write(nombre, clave, variables): la clave se traduce; un texto sin clave se escribe tal cual.
// Al cambiar de idioma se reescribe lo último que se mostró.
export function live(section) {
  const cache = {};
  const last = {};
  const paint = (name) => {
    cache[name] ??= section.querySelector(`[data-live="${name}"]`);
    const text = t(last[name].key, last[name].vars);
    if (cache[name] && cache[name].textContent !== text) cache[name].textContent = text;
  };
  onLang(() => Object.keys(last).forEach(paint));
  return (name, key, vars = {}) => {
    last[name] = { key, vars };
    paint(name);
  };
}

// Devuelve la etiqueta del último umbral alcanzado: [[umbral, etiqueta], …]
export function stageAt(stages, value) {
  let label = stages[0][1];
  for (const [at, name] of stages) if (value >= at) label = name;
  return label;
}
