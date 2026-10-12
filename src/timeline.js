// Línea de tiempo fija: dónde cae cada capítulo en la historia y por dónde va la lectura.
// Escala por tramos, con cortes marcados (36 000 años no caben en una escala lineal):
//   Paleolítico superior  34 000 – 10 000 a. C.  →  2 % – 14 %
//   corte
//   1400 – 1800                                  → 17 % – 45 %
//   1800 – hoy                                   → 45 % – 98 %
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { t, formatNumber, onLang } from './i18n/i18n.js';

const NOW = 2026;

export const CHAPTERS = [
  { id: 'prehistoria', n: 1, from: -34000, to: -12000, lane: 0 },
  { id: 'renacimiento', n: 2, from: 1420, to: 1520, lane: 0 },
  { id: 'romanticismo', n: 3, from: 1800, to: 1850, lane: 0 },
  { id: 'puntillismo', n: 4, from: 1884, to: 1891, lane: 0 },
  { id: 'campo-de-color', n: 5, from: 1952, to: 1970, lane: 0 },
  { id: 'pop', n: 6, from: 1958, to: 1970, lane: 1 }, // contemporáneo del anterior
  { id: 'ia', n: 7, from: 2014, to: NOW, lane: 0 }, // de las GAN (2014) a la difusión (2022) y hoy
];

// El nombre sale del título del capítulo, en el idioma activo
const nameOf = (c) => t(`c${c.n}.title`);
const datesOf = (c) => t(`tl.dates.c${c.n}`) !== `tl.dates.c${c.n}` ? t(`tl.dates.c${c.n}`) : `${c.from}–${c.to}`;

// Secciones que no son un estilo: la aguja se queda en su sitio y el rótulo las nombra
const INTERLUDES = [{ id: 'anatomia', label: 'tl.interlude', year: 'tl.interlude.year', at: 1520 }];

export function scale(year) {
  if (year <= -10000) return 0.02 + (0.12 * (year + 34000)) / 24000;
  if (year < 1400) return 0.155;
  if (year < 1800) return 0.17 + (0.28 * (year - 1400)) / 400;
  return 0.45 + (0.53 * (Math.min(year, NOW) - 1800)) / (NOW - 1800);
}

export function formatYear(year) {
  return year < 0 ? t('tl.bc', { year: formatNumber(-year) }) : `${Math.round(year)}`;
}

export function initTimeline(root) {
  const nav = root.querySelector('.pigmento-timeline');
  if (!nav) return;
  const track = nav.querySelector('.pigmento-timeline__track');
  const readChapter = nav.querySelector('[data-tl="chapter"]');
  const readYear = nav.querySelector('[data-tl="year"]');

  // Posición de marcas y rótulos (dato, no estilo: la hoja solo lee --pigmento-tl-x)
  nav.querySelectorAll('[data-tl-year]').forEach((el) => {
    el.style.setProperty('--pigmento-tl-x', scale(Number(el.dataset.tlYear)));
  });
  const marks = CHAPTERS.map((c) => {
    const el = nav.querySelector(`[data-tl-chapter="${c.id}"]`);
    el.style.setProperty('--pigmento-tl-x', scale(c.from));
    el.style.setProperty('--pigmento-tl-w', Math.max(scale(c.to) - scale(c.from), 0));
    el.dataset.lane = c.lane;
    return { ...c, el, section: document.getElementById(c.id) };
  });

  // Cada capítulo ocupa el scroll entre «arriba en el centro» y «abajo en el centro»
  const triggers = marks.map((m) =>
    ScrollTrigger.create({ trigger: m.section, start: 'top center', end: 'bottom center' }),
  );

  const interludes = INTERLUDES.map((it) => ({
    ...it,
    trigger: ScrollTrigger.create({ trigger: document.getElementById(it.id), start: 'top center', end: 'bottom center' }),
  })).filter((it) => it.trigger.trigger);

  let last = '';
  const update = () => {
    const y = window.scrollY;
    const inter = interludes.find((it) => y >= it.trigger.start && y <= it.trigger.end);
    if (inter) {
      track.style.setProperty('--pigmento-tl-needle', scale(inter.at).toFixed(4));
      const key = `interludio|${inter.id}`;
      if (key !== last) {
        last = key;
        readChapter.textContent = t(inter.label);
        readYear.textContent = t(inter.year);
        marks.forEach((m) => m.el.removeAttribute('aria-current'));
      }
      return;
    }
    let x = scale(CHAPTERS[0].from);
    let chapterLabel = t('tl.start');
    let yearLabel = '';
    let active = null;

    for (let i = 0; i < marks.length; i++) {
      const tr = triggers[i];
      const m = marks[i];
      if (y >= tr.start && y <= tr.end) {
        const k = (y - tr.start) / Math.max(tr.end - tr.start, 1);
        const year = m.from + (m.to - m.from) * k;
        x = scale(year);
        chapterLabel = `${m.n} · ${nameOf(m)}`;
        yearLabel = m.from < 0 ? t('tl.circa', { year: formatYear(year) }) : formatYear(year);
        active = m;
        break;
      }
      const next = marks[i + 1];
      if (next && y > tr.end && y < triggers[i + 1].start) {
        // Entre capítulos: la aguja viaja hacia el siguiente
        const k = (y - tr.end) / Math.max(triggers[i + 1].start - tr.end, 1);
        x = scale(m.to) + (scale(next.from) - scale(m.to)) * k;
        chapterLabel = t('tl.toward', { n: next.n, name: nameOf(next) });
        yearLabel = formatYear(next.from);
        break;
      }
      if (!next && y > tr.end) {
        x = scale(m.to);
        chapterLabel = t('tl.end');
        yearLabel = String(NOW);
      }
    }

    track.style.setProperty('--pigmento-tl-needle', x.toFixed(4));
    const key = `${chapterLabel}|${yearLabel}|${active?.id}`;
    if (key !== last) {
      last = key;
      readChapter.textContent = chapterLabel;
      readYear.textContent = yearLabel;
      marks.forEach((m) => {
        if (m === active) m.el.setAttribute('aria-current', 'location');
        else m.el.removeAttribute('aria-current');
      });
    }
  };

  // Un tramo más corto que el área táctil se dibuja como punto, no como barra estirada
  const measure = () => {
    const width = track.getBoundingClientRect().width;
    const target = parseFloat(getComputedStyle(nav).getPropertyValue('--pigmento-tl-lane')) * 16 || 24;
    marks.forEach((m) => m.el.toggleAttribute('data-narrow', (scale(m.to) - scale(m.from)) * width < target));
  };
  measure();
  window.addEventListener('resize', measure);

  // Texto accesible de cada marca, en el idioma activo
  const labelMarks = () =>
    marks.forEach((m) => {
      const sr = m.el.querySelector('[data-tl-mark]');
      if (sr) sr.textContent = t('tl.mark', { n: m.n, name: nameOf(m), dates: datesOf(m) });
    });
  labelMarks();
  onLang(() => {
    labelMarks();
    last = '';
    update();
  });

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update, onRefresh: update });
  update();
}
