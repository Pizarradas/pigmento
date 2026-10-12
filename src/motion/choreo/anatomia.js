// Interludio · Anatomía de un cuadro
// Motion Spec (modelo de cuatro capas de SYX):
//   qué cambia   → la pila se encaja a carboncillo, cada capa se pinta en su turno, el barniz brilla y la pila se cierra
//   cómo cambia  → scrub; boceto a carbón en WebGL; guías con DrawSVG; titular con SplitText y máscara
//   qué lo activa → el scroll, con el interludio fijado
//   para qué     → explicar: lo que no se ve sostiene lo que se ve
// Receta de isometric/03-animacion: construcción por capas, una timeline por escena, de abajo arriba.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { pinnedChapter } from '../chapter.js';
import { resolveColor } from 'syx-design-system/js/syx-colors.js';
import { LAYERS } from '../../paint/scenes/anatomy.js';
import { t, onLang } from '../../i18n/i18n.js';

const SVG = 'http://www.w3.org/2000/svg';
const BADGE_OFFSET = 18; // px entre el ancla de la capa y su etiqueta

export function anatomia({ section, scene, mm, motion }) {
  const lienzo = section.querySelector('.pigmento-lienzo');
  const svg = section.querySelector('.pigmento-anatomia__leaders');
  const badges = [...section.querySelectorAll('.pigmento-anatomia__badge')];
  const items = [...section.querySelectorAll('.pigmento-anatomia__item')];
  const list = section.querySelector('.pigmento-anatomia__list');
  const title = section.querySelector('.pigmento-anatomia__title');

  // Una guía por capa: un punto en la esquina de la losa y un trazo hasta su número
  const paths = Array.from({ length: LAYERS }, () => {
    const path = document.createElementNS(SVG, 'path');
    svg.append(path);
    return path;
  });

  // Coloca números y guías donde cae cada capa con la pila abierta
  const place = () => {
    const r = lienzo.getBoundingClientRect();
    if (r.width < 2) return;
    scene.anchors(r.width, r.height).forEach(([x, y], i) => {
      paths[i].setAttribute('d', `M ${x.toFixed(1)} ${y.toFixed(1)} H ${(x + BADGE_OFFSET).toFixed(1)}`);
      badges[i].style.setProperty('--pigmento-anchor-x', (x + BADGE_OFFSET).toFixed(1));
      badges[i].style.setProperty('--pigmento-anchor-y', y.toFixed(1));
    });
  };
  place();
  window.addEventListener('resize', place);

  // Tinta del boceto: el --pigmento-ink de la página, en claro y en oscuro
  const syncInk = () => {
    try {
      const rgb = resolveColor('var(--pigmento-ink)', { format: 'rgb' }).match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => Number(v) / 255);
      scene.setInk(rgb);
    } catch {
      /* sin conversión: se queda la tinta por defecto */
    }
  };
  syncInk();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncInk);
  new MutationObserver(syncInk).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  let current = -2;
  const setActive = (index) => {
    if (index === current) return;
    current = index;
    items.forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
      if (i === index) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    });
    badges.forEach((el, i) => el.classList.toggle('is-active', i === index));
  };

  // Señalar una capa en la lista la levanta en la pila y abre su descripción
  let hovering = -1;
  items.forEach((el, i) => {
    el.addEventListener('pointerenter', () => {
      hovering = i;
      scene.hover.layer = i;
      gsap.to(scene.hover, { on: 1, duration: motion.base, ease: 'power2.out', overwrite: 'auto' });
      setActive(i);
    });
    el.addEventListener('pointerleave', () => {
      hovering = -1;
      gsap.to(scene.hover, { on: 0, duration: motion.slow, ease: 'power2.inOut', overwrite: 'auto' });
      const f = scene.params.focus;
      setActive(f >= -0.5 ? Math.min(LAYERS - 1, Math.round(f)) : -1);
    });
  });

  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    length: '+=420%',
    final: { explode: 1, draw: 1, f0: 1, f1: 1, f2: 1, f3: 1, f4: 1, f5: 1, f6: 1, f7: 1, focus: -1, sheen: 0.5 },
    build: (tl, p) => {
      list.classList.add('is-guided');
      // Titular: las letras suben dentro de su máscara, una vez, al entrar
      const splitOpts = { type: 'chars,words', mask: 'chars' };
      let split = SplitText.create(title, splitOpts);
      gsap.from(split.chars, {
        yPercent: 110,
        duration: motion.slow * 2,
        ease: 'power3.out',
        stagger: motion.fast / 6,
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      });

      // 1 · Encaje a carboncillo: guías isométricas y aristas, de abajo arriba
      tl.to(p, { draw: 1, duration: 3 }, 0)
        .fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, stagger: 0.1 }, 2.4)
        .fromTo(badges, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.1 }, 2.6);
      // 2 · Cada capa se pinta en su orden, y la lista sigue a la capa que se pinta
      for (let i = 0; i < LAYERS; i++) {
        tl.to(p, { [`f${i}`]: 1, duration: 0.85, ease: 'power1.inOut' }, 3.4 + i * 0.9);
      }
      tl.fromTo(p, { focus: -0.6 }, { focus: LAYERS - 0.8, duration: 7.2 }, 3.4)
        // 3 · Barniz, se recogen las guías y la pila se cierra en el cuadro terminado
        .to(p, { focus: -1, duration: 0.3 }, 10.7)
        .to(p, { sheen: 1, duration: 1.6 }, 10.8)
        .to(paths, { drawSVG: '0%', duration: 0.5, stagger: 0.04 }, 11.4)
        .to(badges, { autoAlpha: 0, duration: 0.4, stagger: 0.04 }, 11.4)
        .to(p, { explode: 0, duration: 3, ease: 'power2.inOut' }, 12)
        .to(p, { lines: 0, duration: 1.2 }, 13.6); // el boceto queda debajo de la pintura

      // Otro idioma: se deshace el troceado, se pone el título nuevo y se vuelve a trocear (ya visible)
      const offLang = onLang(() => {
        split.revert();
        title.textContent = t('an.title');
        split = SplitText.create(title, splitOpts);
      });

      return () => {
        offLang();
        list.classList.remove('is-guided');
      };
    },
    onProgress: (time, reduced) => {
      if (reduced) {
        gsap.set(paths, { drawSVG: '100%' });
        gsap.set(badges, { autoAlpha: 1 });
        setActive(-1);
        return;
      }
      if (hovering >= 0) return;
      const f = scene.params.focus;
      setActive(f >= -0.5 ? Math.min(LAYERS - 1, Math.round(f)) : -1);
    },
  });
}
