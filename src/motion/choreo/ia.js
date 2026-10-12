// Capítulo 7 · Arte con IA
// Motion Spec (modelo de cuatro capas de SYX):
//   qué cambia   → se escribe la instrucción y la imagen se genera: de la cueva (imagen → imagen)
//                  o de ruido puro (texto → imagen), con sus pasos y su decodificación
//   cómo cambia  → scrub de un único avance k; el texto se «descifra» letra a letra
//   qué lo activa → el scroll, con el capítulo fijado; el selector de partida cambia de modo
//   para qué     → enseñar que la imagen ya no se pinta: se pide y se calcula, y que puede
//                  partir de una imagen anterior (el bisonte de hace 15 000 años)
import { gsap } from 'gsap';
import { pinnedChapter, live } from '../chapter.js';
import { t, onLang } from '../../i18n/i18n.js';

const GLYPHS = '01░▒▓<>/{}[]#*+=';
const TYPE_END = 1.5; // la instrucción se escribe en el primer tramo
const K_START = 1.6;
const K_LENGTH = 8.2;

// La instrucción aparece de izquierda a derecha; por delante, unos signos que aún no se han resuelto.
// Determinista: el mismo progreso da el mismo texto (sirve el scrub hacia atrás).
function typed(text, k) {
  const n = Math.floor(text.length * k);
  if (n >= text.length) return text;
  let tail = '';
  const ahead = Math.min(4, text.length - n);
  for (let i = 0; i < ahead; i++) {
    const h = Math.abs(Math.sin((n + 1) * 12.9898 + i * 78.233) * 43758.5453) % 1;
    tail += text[n + i] === ' ' ? ' ' : GLYPHS[Math.floor(h * GLYPHS.length)];
  }
  return text.slice(0, n) + tail;
}

export function ia({ section, scene, mm, motion }) {
  const write = live(section);
  const prompt = section.querySelector('.pigmento-prompt');
  const buttons = [...section.querySelectorAll('[data-ai-mode]')];
  let lastTime = Infinity;

  const show = (time) => {
    lastTime = time;
    const typing = Number.isFinite(time) ? Math.min(Math.max(time / TYPE_END, 0), 1) : 1;
    write('prompt', typed(t(`c7.prompt.${scene.mode}`), typing));
    prompt?.classList.toggle('is-typing', typing < 1);
    const st = scene.state;
    const before = Number.isFinite(time) && time < K_START;
    write('stage', before ? (scene.mode === 'img' ? 'c7.s.input' : 'c7.s.prompt') : `c7.s.${st.stage}`);
    write('steps', 'live.of', { n: st.steps, total: st.total });
  };
  onLang(() => show(lastTime));

  // Selector de partida: la cueva (imagen → imagen) o ruido puro (texto → imagen)
  const paint = () =>
    buttons.forEach((b) => {
      const on = b.dataset.aiMode === scene.mode;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('atom-btn--filled', on);
    });
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      if (scene.mode === b.dataset.aiMode) return;
      scene.mode = b.dataset.aiMode;
      // Un fundido corto para que el cambio se lea como «otra generación», no como un salto
      gsap.fromTo(scene.params, { fade: 0.35 }, { fade: 1, duration: motion.slow, ease: 'power2.out' });
      paint();
      show(lastTime);
    }),
  );
  paint();

  pinnedChapter({
    section,
    scene,
    mm,
    motion,
    length: '+=340%',
    final: { k: 1 },
    build: (tl, p) => {
      tl.to({}, { duration: TYPE_END }, 0)
        // Un único avance: el modo decide qué significa cada tramo (diffusion() en la escena)
        .fromTo(p, { k: 0 }, { k: 1, duration: K_LENGTH }, K_START)
        .to({}, { duration: 0.4 }, K_START + K_LENGTH);
    },
    onProgress: (time) => show(time),
  });
}
