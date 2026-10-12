// Pigmento · Fase 0 — punto de entrada
// SYX (tokens del tema base, componentes y utilidades) → fuentes → hoja de la app → motor → coreografías.
import 'syx-design-system/tokens/example-02.css';
import 'syx-design-system/components/core.css';
import 'syx-design-system/utilities.css';
import './fonts.css';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './scss/main.scss';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import { readMotionTokens } from './motion/tokens.js';
import { prehistoria } from './motion/choreo/prehistoria.js';
import { renacimiento } from './motion/choreo/renacimiento.js';
import { anatomia } from './motion/choreo/anatomia.js';
import { romanticismo } from './motion/choreo/romanticismo.js';
import { puntillismo } from './motion/choreo/puntillismo.js';
import { campoDeColor } from './motion/choreo/campo-de-color.js';
import { pop } from './motion/choreo/pop.js';
import { ia } from './motion/choreo/ia.js';
import { PaintEngine } from './paint/engine.js';
import { CharcoalScene } from './paint/scenes/charcoal.js';
import { WatercolorScene } from './paint/scenes/watercolor.js';
import { PointillismScene } from './paint/scenes/pointillism.js';
import { StainScene, PopScene } from './paint/scenes/acrylic.js';
import { AnatomyScene } from './paint/scenes/anatomy.js';
import { AiScene } from './paint/scenes/ai.js';
import { initTimeline } from './timeline.js';
import { attachPointer } from './motion/pointer.js';
import { initAmbience } from './motion/ambience.js';
import { initSound } from './sound/sound.js';
import { PUNTILLISMO, rgbCss } from './paint/palettes.js';
import { applyDom, initLangSwitch, onLang } from './i18n/i18n.js';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, SplitText);

const root = document.documentElement;
// En el visor de Artifacts el <body> lo pone el visor: la clase se añade aquí también.
document.body.classList.add('pigmento-body');
// Idioma antes de medir nada: los textos cambian alturas y pines
applyDom();
initLangSwitch(document);
const motion = readMotionTokens();
const mm = gsap.matchMedia();

// --- Scroll suave, solo si el sistema no pide reducir movimiento ------------
mm.add('(prefers-reduced-motion: no-preference)', () => {
  const lenis = new Lenis({ autoRaf: false, lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  const raf = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(raf);
    lenis.destroy();
  };
});

// --- Muestras de la paleta: el mismo dato que pinta el shader ---------------
document.querySelectorAll('.pigmento-palette__swatch').forEach((el) => {
  const pigment = PUNTILLISMO[Number(el.dataset.pigment)];
  if (pigment) el.style.setProperty('--pigmento-swatch', rgbCss(pigment.rgb));
});

// --- Motor pictórico ---------------------------------------------------------
const engine = new PaintEngine(document.querySelector('.pigmento-stage'));
if (!engine.ok) root.classList.add('is-no-webgl');

// En orden cronológico: del carbón en la cueva a la imagen generada
const chapters = {
  prehistoria: { scene: new CharcoalScene('cueva'), choreo: prehistoria },
  renacimiento: { scene: new CharcoalScene('perspectiva'), choreo: renacimiento },
  anatomia: { scene: new AnatomyScene(), choreo: anatomia }, // interludio: cómo está hecho un óleo
  romanticismo: { scene: new WatercolorScene(), choreo: romanticismo },
  puntillismo: { scene: new PointillismScene(), choreo: puntillismo },
  'campo-de-color': { scene: new StainScene(), choreo: campoDeColor },
  pop: { scene: new PopScene(), choreo: pop },
  ia: { scene: new AiScene(), choreo: ia },
};

for (const [id, { scene, choreo }] of Object.entries(chapters)) {
  const section = document.getElementById(id);
  const lienzo = section.querySelector('.pigmento-lienzo');
  engine.add(scene, lienzo);
  choreo({ section, scene, mm, motion });
  // Cada lienzo es también una herramienta en la mano de quien mira (la anatomía se señala desde la lista)
  if (id !== 'anatomia') attachPointer(scene, lienzo, { live: id === 'prehistoria' });
}
engine.start();
initTimeline(document);
initAmbience(['prehistoria', 'ia']); // la cueva y la pantalla, a oscuras
initSound({ chapters, button: document.querySelector('[data-sound]') });

// Las fuentes cambian alturas: se recalculan los pines cuando han cargado
document.fonts?.ready.then(() => ScrollTrigger.refresh());
onLang(() => ScrollTrigger.refresh());

// --- HUD de rendimiento (?hud) ----------------------------------------------
if (new URLSearchParams(location.search).has('hud')) {
  const hud = document.querySelector('.pigmento-hud');
  hud.hidden = false;
  const update = () => {
    hud.textContent = engine.ok ? engine.describe() : 'Sin WebGL2 · imagen de respaldo';
  };
  update();
  setInterval(update, 500);
}

// Acceso para pruebas automáticas (medición de frames)
window.__pigmento = { engine, chapters, ScrollTrigger };
