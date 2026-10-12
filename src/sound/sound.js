// Sonido procedural (Web Audio), apagado por defecto: solo suena tras pulsar «Sonido».
// Sin muestras grabadas: todo sale de un búfer de ruido blanco filtrado y de osciladores.
// Cada capítulo suena a su técnica y el sonido lo mueve lo mismo que mueve la pintura:
// la velocidad a la que avanzan los parámetros de la escena (el scroll) y el puntero.
//   carbón → ruido en banda de 2–4 kHz al ritmo del trazo
//   antorcha → chisporroteo y rumor grave de cueva
//   agua → ruido grave y gotas
//   puntos → toques secos, uno por grupo de puntos que llega
//   acrílico → rodillo, cinta que se arranca, rasqueta de serigrafía
//   difusión → siseo que baja con el ruido, un clic por paso y un acorde al decodificar
import { gsap } from 'gsap';

const TAU_S = 0.06; // suavizado de las ganancias (s)

export function initSound({ chapters, button }) {
  if (!button || !(window.AudioContext || window.webkitAudioContext)) {
    if (button) button.hidden = true;
    return;
  }
  let ctx = null;
  let master = null;
  let noise = null;
  let v = null;
  let on = false;
  const prev = {};
  let lastStep = -1;

  const makeNoise = () => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };

  const voice = (type, freq, q) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.loopStart = Math.random();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return { f, g };
  };

  // Golpe corto de ruido filtrado (toque de pincel, chasquido de la llama, clic digital)
  const click = (freq, dur, gain, type = 'bandpass') => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  };

  // Gota de agua: un seno que cae de tono
  const drop = (gain) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(700 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.12);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.18);
  };

  const build = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noise = makeNoise();
    v = {
      rumble: voice('lowpass', 140, 0.7),
      fire: voice('bandpass', 1700, 0.9),
      scratch: voice('bandpass', 3200, 1.3),
      water: voice('lowpass', 700, 0.6),
      roller: voice('bandpass', 520, 2.2),
      hiss: voice('highpass', 4500, 0.7),
    };
    // Acorde de la imagen decodificada: La, Do#, Mi, La (senos suaves)
    v.chord = ctx.createGain();
    v.chord.gain.value = 0;
    v.chord.connect(master);
    [220, 277.18, 329.63, 440].forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = 0.22 / (i + 1);
      o.connect(g).connect(v.chord);
      o.start();
    });
  };

  const set = (node, value) => node.gain.setTargetAtTime(value, ctx.currentTime, TAU_S);
  const freq = (voiceRef, hz) => voiceRef.f.frequency.setTargetAtTime(hz, ctx.currentTime, 0.08);

  // Velocidad de un parámetro (unidades por segundo), con memoria por escena
  const speed = (id, name, value, dt) => {
    const k = `${id}.${name}`;
    const before = prev[k] ?? value;
    prev[k] = value;
    return Math.abs(value - before) / Math.max(dt, 1 / 120);
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // El capítulo que suena es el que cruza el centro de la pantalla
  const sections = Object.keys(chapters).map((id) => ({ id, el: document.getElementById(id), ...chapters[id] }));
  const current = () => {
    const mid = window.innerHeight / 2;
    return sections.find((s) => {
      const r = s.el.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    });
  };

  const tick = (_, deltaMs) => {
    if (!on || !ctx) return;
    const dt = Math.min(deltaMs, 100) / 1000;
    const c = current();
    const g = { rumble: 0, fire: 0, scratch: 0, water: 0, roller: 0, hiss: 0, chord: 0 };
    if (c) {
      const p = c.scene.params;
      const ptr = c.scene.pointer ?? { on: 0, x: 0, y: 0 };
      const pv = speed(c.id, 'ptr', ptr.x + ptr.y, dt) * ptr.on; // px/s del puntero
      const s = (name) => speed(c.id, name, p[name] ?? 0, dt);
      switch (c.id) {
        case 'prehistoria': {
          const flame = Math.max(p.torch, ptr.on);
          g.rumble = 0.35;
          g.fire = flame * (0.08 + 0.1 * Math.random());
          if (Math.random() < flame * 0.06) click(1800 + Math.random() * 2500, 0.03, 0.12 * flame);
          g.scratch = clamp(s('draw') * 3) * 0.3;
          g.water = clamp(s('ochre') * 3) * 0.25; // el soplado del ocre
          freq(v.water, 1600);
          freq(v.scratch, 2600 + Math.random() * 600);
          break;
        }
        case 'renacimiento':
          g.scratch = clamp((s('draw') + s('tiles')) * 3) * 0.32;
          g.water = clamp((s('tone') + s('chalk')) * 4) * 0.2; // difumino: un roce sordo
          freq(v.water, 450);
          freq(v.scratch, 3000 + Math.random() * 900);
          break;
        case 'anatomia': {
          let paint = 0;
          for (let i = 0; i < 8; i++) paint += s(`f${i}`);
          g.scratch = clamp(s('draw') * 3) * 0.28;
          g.water = clamp(paint * 2) * 0.22;
          g.chord = clamp(s('sheen') * 2) * 0.25;
          freq(v.water, 900);
          freq(v.scratch, 3200);
          break;
        }
        case 'romanticismo': {
          const wash = s('sky') + s('sun') + s('cloud') + s('sea') + s('reflect');
          g.water = 0.05 + p.wet * 0.12 + clamp(wash * 2) * 0.25 + clamp(pv / 900) * 0.2;
          freq(v.water, 500 + p.wet * 500);
          if (Math.random() < clamp(s('bloom') * 2 + pv / 4000) * 0.5) drop(0.12);
          break;
        }
        case 'puntillismo': {
          const n = Math.min(4, Math.round(s('gather') * 18 + Math.random() * 0.6));
          for (let i = 0; i < n; i++) click(3500 + Math.random() * 3500, 0.018, 0.09);
          g.scratch = clamp(s('zoom') * 2) * 0.1;
          freq(v.scratch, 6000);
          break;
        }
        case 'campo-de-color':
          g.water = clamp((s('p0') + s('p1') + s('p2') + s('p3')) * 2.5) * 0.35 + clamp(pv / 800) * 0.15;
          freq(v.water, 320);
          g.rumble = clamp(s('tiltAmount') * 2) * 0.3;
          break;
        case 'pop':
          g.roller = clamp((s('paint1') + s('paint2') + s('disc')) * 2.5) * 0.4 + clamp(s('print') * 3) * 0.3;
          freq(v.roller, p.print > 0.02 && p.print < 0.98 ? 900 : 520);
          g.scratch = clamp(s('tape') * 3) * 0.2;
          g.hiss = clamp(s('peel') * 4) * (0.15 + 0.15 * Math.random()); // la cinta al arrancarse
          freq(v.scratch, 1500);
          break;
        case 'ia': {
          const st = c.scene.state;
          const abar = Math.cos((st.t * Math.PI) / 2) ** 2;
          g.hiss = st.appear * (1 - abar) * 0.14 * (1 - st.decode);
          if (st.steps !== lastStep && lastStep >= 0 && st.steps > 0) click(1200, 0.02, 0.07, 'highpass');
          lastStep = st.steps;
          g.chord = p.k > 0.8 ? st.decode * 0.3 : 0;
          if (c.scene.mode === 'img' && st.decode > 0) g.scratch = clamp(s('k') * 2) * 0.15; // carbón al aparecer el dibujo
          break;
        }
        default:
      }
    }
    Object.entries(g).forEach(([name, value]) => set(name === 'chord' ? v.chord : v[name].g, value));
  };

  const paint = () => button.setAttribute('aria-pressed', String(on));
  button.addEventListener('click', () => {
    on = !on;
    if (on && !ctx) build();
    if (on) ctx.resume();
    if (ctx) master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.25);
    button.classList.toggle('atom-btn--filled', on);
    paint();
  });
  paint();
  gsap.ticker.add(tick);
  // Con la pestaña oculta, el contexto se suspende
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (on) ctx.resume();
  });
}
