// Idioma de la página: español por defecto, inglés como alternativa.
// Prioridad: ?lang= en la dirección → elección guardada → idioma del navegador → español.
// El HTML lleva el español escrito; cada texto traducible tiene data-i18n="clave"
// (o data-i18n-html si lleva marcado) y los atributos, data-i18n-attr="atributo:clave;…".
import { STRINGS } from './strings.js';

export const LANGS = ['es', 'en'];
const STORAGE_KEY = 'pigmento-lang';
const listeners = new Set();

function detect() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    /* almacenamiento bloqueado: se sigue con el navegador */
  }
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

let lang = detect();

export const getLang = () => lang;

export function t(key, vars = {}) {
  const text = STRINGS[lang][key] ?? STRINGS.es[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

// Número con el separador de miles de cada idioma: 36 000 · 36,000
export function formatNumber(n) {
  const s = Math.round(n).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { useGrouping: true });
  return lang === 'es' ? s.replace(/\./g, ' ') : s;
}

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml); // textos propios del diccionario, no de la persona
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
  document.documentElement.lang = lang;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
}

export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* sin almacenamiento: el cambio vale para esta visita */
  }
  applyDom();
  listeners.forEach((fn) => fn(lang));
}

// Selector ES / EN: botones de SYX (--primary; el activo, --filled) con aria-pressed
export function initLangSwitch(root = document) {
  const buttons = [...root.querySelectorAll('[data-lang-switch]')];
  const paint = () =>
    buttons.forEach((b) => {
      const on = b.dataset.langSwitch === lang;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('atom-btn--filled', on); // el idioma activo, relleno
    });
  buttons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langSwitch)));
  onLang(paint);
  paint();
}
