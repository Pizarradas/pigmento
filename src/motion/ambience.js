// Ambiente: en la cueva y ante la pantalla de la IA la página entera se queda a oscuras.
// Usa el mecanismo de temas de SYX (data-theme="dark" en la raíz), así que todos los
// contrastes son los del tema oscuro ya medido. Al salir se devuelve el tema que había,
// sea el del sistema (sin atributo) o el que eligió quien lee.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initAmbience(ids) {
  const root = document.documentElement;
  let original = root.getAttribute('data-theme');
  let night = false;
  let ours = false;

  // Si el tema cambia desde fuera (el selector del visor), esa pasa a ser la elección que se devuelve
  new MutationObserver(() => {
    if (ours) return;
    original = root.getAttribute('data-theme');
    if (night) apply(true, true);
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  function apply(next, force = false) {
    if (next === night && !force) return;
    night = next;
    ours = true;
    if (night) root.setAttribute('data-theme', 'dark');
    else if (original === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', original);
    root.classList.toggle('is-night', night);
    // El observador se entera en una microtarea: se libera la marca después
    queueMicrotask(() => {
      ours = false;
    });
  }

  const triggers = ids
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .map((el) => ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onToggle: () => update() }));
  function update() {
    apply(triggers.some((t) => t.isActive));
  }
  ScrollTrigger.addEventListener('refresh', update);
  update();
}
