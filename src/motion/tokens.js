// Duraciones y curvas: se leen de los tokens de SYX, nunca se escriben en el JS.
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

function seconds(value, fallback) {
  const v = value.trim();
  if (v.endsWith('ms')) return parseFloat(v) / 1000;
  if (v.endsWith('s')) return parseFloat(v);
  return fallback;
}

export function readMotionTokens(root = document.documentElement) {
  const cs = getComputedStyle(root);
  const get = (name) => cs.getPropertyValue(name);
  return {
    fast: seconds(get('--semantic-duration-fast'), 0.15),
    base: seconds(get('--semantic-duration-base'), 0.25),
    slow: seconds(get('--semantic-duration-slow'), 0.4),
  };
}

// Firma de movimiento «pincelada»: carga lenta, arrastre rápido, asentamiento suave.
// Es la versión GSAP de la curva; el tema de la Fase 1 la llevará también a un token CSS.
export const PINCELADA = CustomEase.create('pincelada', 'M0,0 C0.42,0 0.24,1 1,1');
