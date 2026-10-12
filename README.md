# Pigmento · prototipo

Siete rupturas de la pintura, en orden cronológico, pintadas en tiempo real mientras se lee. En español y en inglés. Una línea de tiempo fija al pie sitúa cada capítulo en la historia y sigue la lectura con una aguja y el año.

| # | Capítulo | Fechas | Técnica simulada | Retícula |
| --- | --- | --- | --- | --- |
| 1 | Prehistoria | hace c. 36 000 – 14 000 años | Bisonte polícromo al modo de Altamira: contorno a carbón, ocre soplado, negro de carbón y manganeso, grabado; las lomas de la roca dan el volumen bajo la antorcha | O12 ruptura a sangre |
| 2 | Renacimiento | 1420–1520 | Carboncillo, difumino y tiza sobre papel azul: construcción de Alberti y esfera en sfumato | O7 espejo |
| · | Interludio · Anatomía de un cuadro | siglo XVI | Óleo sobre lienzo en ocho capas, en isometría real: encaje a carboncillo y después pintura capa a capa | Texto hasta t1 |
| 3 | Romanticismo | c. 1800–1850 | Acuarela húmedo sobre húmedo, secado, granulado | O10 pistas φ |
| 4 | Puntillismo | 1884–1891 | Toques puros y mezcla óptica | Compuesta, línea t1 + E(3,8) |
| 5 | Campo de color | 1952–1970 | Acrílico diluido que tiñe algodón crudo, con el bastidor inclinado | Banda con subgrid |
| 6 | Pop | 1958–1970 | Acrílico opaco: rodillo, cinta, retirada, disco y serigrafía Ben-Day en registro | O7 espejo |
| 7 | Arte con IA | 2014–hoy | Difusión latente imitada: instrucción en texto, ruido gaussiano en celdas de 8 px, 50 pasos con calendario coseno, decodificación a píxeles | O12 a sangre (cierra el círculo con la cueva) |

## Arrancar

```bash
npm install
npm run dev             # desarrollo
npm run build           # dist/ con assets separados
npm run build:artifact  # dist-single/pigmento.html autocontenido (Artifact de claude.ai)
npm run scan            # npx syx-scan: debe dar 0 hallazgos
```

Parámetros de la URL:

- `?hud` muestra nivel de calidad, frame medio y peor frame de los últimos 2 s, CPU de render y número de toques.
- `?nivel=0|1|2` fija un peldaño de calidad (sin él, la escalera es automática).

## Cómo está hecho

| Capa | Dónde | Qué hace |
| --- | --- | --- |
| SYX | `node_modules/syx-design-system` | Tokens del tema base `example-02`, componentes y utilidades. La app solo consume (CONSUMING.md). |
| Identidad | `src/scss/_tokens.scss` | Overrides de tokens SYX existentes (lino crudo / betún, ultramar, siena, Fraunces + Instrument Sans + Plex Mono) y tokens `--pigmento-*`. En la Fase 1 pasa a tema `pigmento`. |
| Retícula | `src/scss/main.scss` | Compuesta 3 + 4 sobre 12 unidades con líneas nombradas. Cap. 3: pistas φ (O10). Cap. 5: el lienzo arranca en la línea de tercios `t1`; paleta en ritmo euclídeo E(3,8) (O6). |
| Movimiento | `src/motion/` | Lenis + ScrollTrigger. Una timeline con scrub por capítulo; `gsap.matchMedia` separa escritorio, móvil y movimiento reducido. Duraciones leídas de los tokens SYX. Curva «pincelada» con CustomEase. |
| Pintura | `src/paint/` | Un único contexto WebGL2 fijo detrás de la página. Cada escena pinta solo el rectángulo de su `.pigmento-lienzo`. GSAP anima `scene.params`; el motor solo pinta cuando algo cambia. |

**Carboncillo** (`scenes/charcoal.js`, `glsl/charcoal-*.{vert,frag}`): cada trazo es una cinta de triángulos con su tiempo de dibujo, presión, temblor de la mano y remates más finos. El carbón solo se queda en las crestas del soporte (roca o papel), según la presión. Los dibujos están en `charcoal-drawings.js`: el bisonte como rutas SVG y la perspectiva calculada con la proyección de Alberti (horizonte, punto de fuga, distancia).

**Altamira** (`scenes/bison.js`): el bisonte es un dibujo original en rutas SVG por zonas (silueta, negros, sombreado, contorno, grabado). Las zonas se pintan en una máscara con Canvas 2D y el shader las usa con el grano de la roca. La pared tiene lomas que coinciden con el cuerpo, la giba y el muslo; su normal se calcula en el shader y una antorcha puntual, rasante, que recorre la pared, las hace aparecer.

**Acrílicos** (`scenes/acrylic.js`): en mancha, cuatro vertidos que corren según la inclinación del bastidor y tiñen el tejido; en Pop, capas opacas que se tapan entre sí, cinta que protege lo de debajo y una trama Ben-Day que entra fuera de registro y encaja.

**Anatomía** (`scenes/anatomy.js`, `motion/choreo/anatomia.js`): la isometría real del conocimiento `isometric` de SYX (giro de 45°, inclinación de 35,264°, `sx = (x − y)·cos 30°`, `sy = (x + y)/2 − z`) y sus tres tonos por cara con luz arriba a la izquierda. Ocho losas en orden de pintor: bastidor, lienzo, encolado, preparación, dibujo subyacente, imprimatura, capas pictóricas y barniz. Primero se encajan las aristas y las guías isométricas a carboncillo (con la tinta de la página: oscura en claro, clara en oscuro). Después cada capa se pinta con una pasada de pincel mientras su descripción se abre en la lista; el barniz brilla, la pila se cierra y el boceto queda debajo. El titular entra con SplitText y máscara.

**Arte con IA** (`glsl/ai.frag`, `scenes/ai.js`, `motion/choreo/ia.js`): no hay red neuronal; el shader recorre a la vista el proceso de un modelo de difusión. Hay dos partidas, que se eligen en la cartela, y comparten el mismo avance del scroll (`diffusion(k, modo)` en la escena).
- *La cueva* (por defecto, imagen → imagen). Se parte del bisonte del capítulo 1 sobre la roca, que se codifica al espacio latente (los píxeles saltan a celdas de 8 px, el paso inverso de la decodificación). Después se le añade ruido hasta la fuerza 0,72, lo que da 36 de 50 pasos, como en un img2img. Con la imagen casi ahogada, la estimación cambia de la cueva al dibujo nuevo, y la limpieza termina en un estudio realista a carboncillo sobre papel. El dibujo tiene encaje de taller (línea de suelo y óvalos), luz lateral, pelo rayado en la dirección de la lana, luces levantadas con goma, contorno más grueso del lado de la sombra, sombra difuminada en el suelo, y el carbón queda en el grano del papel.
- *Ruido puro* (texto → imagen). Se parte de ruido gaussiano y se limpia en 50 pasos hacia la versión de cine: contraluz de un sol enorme, doble luz de contorno, vaho, rayos cortados por la silueta, hierba alta, y un cielo cuyos puntos puros del capítulo 4 se vuelven bokeh.

Las dos imágenes nuevas usan el bisonte «reinterpretado»: la misma pose que el de Altamira, pero con anatomía real (giba, barba, zahones, cuernos afilados). El volumen sale de una textura construida una vez en JS: la silueta se convierte en altura «inflada» por transformada de distancia (chaflán 3-4) y desenfoques separables. Canales: R volumen, G lana, B silueta difuminada (el borde peludo) y A cuernos. El ruido sigue `x_t = √ᾱ·x̂₀ + √(1−ᾱ)·ε`, con ruido gaussiano (Box-Muller, semilla 1886) por celda latente y `ᾱ = cos²(t·π/2)`. La estimación va de celdas de 128 px a 8 px, y la imagen a resolución completa solo se calcula en las celdas ya decodificadas.

**Shaders minificados al construir** (`vite.config.js`): los comentarios del GLSL documentan cada técnica; un plugin los quita junto con las sangrías al construir. Ahorra unos 7 KB comprimidos.

**Idiomas** (`src/i18n/`): español por defecto, inglés de EE. UU. como alternativa. El HTML lleva el español; cada texto tiene `data-i18n` (o `data-i18n-html` / `data-i18n-attr`) y `strings.js` guarda los dos diccionarios. Prioridad: `?lang=en|es` → elección guardada → idioma del navegador → español. El selector ES / EN está en la línea de tiempo (un `mol-btn-group` de SYX con `aria-pressed`; el activo, `--filled`). El cambio es en caliente: las cartelas vivas, la línea de tiempo (nombres, «a. C.» / «BC», separador de miles), el titular troceado con SplitText y la instrucción del capítulo 7 se reescriben, y ScrollTrigger recalcula los pines.

**Inmersión** (`motion/pointer.js`, `motion/ambience.js`, `sound/sound.js`):
- *El lienzo es una herramienta.* Con el puntero (o el dedo) dentro de cada lienzo: en la cueva llevas la antorcha, que recorre las lomas y parpadea; en el Renacimiento mueves la lámpara del taller y cambian la luz, la sombra arrojada y la tiza de la esfera; en la acuarela una esponja húmeda levanta color y deja borde de coliflor; en el Puntillismo una lupa de ojo de pez (aumento ×3) enseña los puntos de cerca; en Campo de color inclinas el bastidor y la pintura corre hacia el cursor; en Pop desajustas la pantalla de serigrafía; en la IA una lente devuelve la imagen a su ruido latente. En la anatomía, señalar una capa de la lista la levanta en la pila. Una pista (atom-pill) en la esquina lo dice y se apaga mientras se usa. El motor solo repinta cuando el puntero cambia.
- *Ambiente.* Al entrar en la cueva y ante la pantalla de la IA la página entera se apaga: se usa el tema oscuro de SYX (`data-theme="dark"`) y al salir se devuelve el tema que había, el del sistema o el elegido. Fondo y texto se funden con `--pigmento-duration-ambience`; con «reducir movimiento», el cambio es directo.
- *Sonido procedural*, apagado por defecto (botón «Sonido» en la línea de tiempo, `aria-pressed`). Web Audio sin muestras: ruido filtrado y osciladores. Suena lo que mueve la pintura (la velocidad de los parámetros con el scroll y el puntero): carbón rascando, antorcha y rumor de cueva, agua y gotas, toques secos de puntos, rodillo, cinta arrancada y rasqueta, siseo de difusión con un clic por paso y un acorde al decodificar. Se suspende con la pestaña oculta.

**Línea de tiempo** (`src/timeline.js`): escala por tramos con cortes (Paleolítico · 1400–1800 · 1800–hoy), porque 36 000 años no caben en una escala lineal. Cada capítulo es un enlace con su tramo de años; Campo de color y Pop van en dos carriles porque son contemporáneos.

**Acuarela** (`glsl/watercolor.frag`): cinco aguadas como distancias con signo deformadas por fbm. En húmedo, bordes blandos y mezcla espectral Kubelka-Munk de 38 bandas (spectral.js v2, MIT). Al secar: oscurecimiento irregular del borde, granulado del ultramar en los valles del papel, flor de agua y pincel seco en el reflejo.

**Puntillismo** (`scenes/pointillism-data.js`): cada toque recibe un solo pigmento puro. Se elige el par de la paleta cuya mezcla óptica (media en luz lineal, como hace el ojo) queda más cerca del motivo y se sortea uno de los dos con su peso. Se calcula en un Worker (~110 ms en portátil) para no bloquear el hilo principal.

## Derivación de números (gridcalc)

```bash
gridcalc compose --font instrument-sans-latin-400-normal.woff2 --lang es --use reading --density spacious --columns 12
gridcalc compose --font fraunces-latin-full-normal.woff2 --axes wght=400,opsz=144 --use scanning --heading-steps 9
gridcalc compound --divisions 3,4
gridcalc tracks --series geometric --count 6 --ratio 1.618
gridcalc rhythm --k 3 --n 8
```

Aviso pendiente de `compose`: a 320–360 px el padding, el gutter y el margen valen 16 px, así que la cadena de proximidad no es estricta en el mínimo. No afecta a esta prueba (una columna en móvil), pero se resuelve en la Fase 1.

## Estado de la puerta de la Fase 0

Se mantiene la de la prueba técnica: los dos capítulos que marcan los extremos de carga siguen siendo Romanticismo y Puntillismo.

**Puerta:** frame ≤ 16 ms en escritorio y fallback correcto en móvil.

| Comprobación | Resultado |
| --- | --- |
| `npx syx-scan src index.html` | 0 hallazgos |
| JS inicial (gzip) | 95 KB con los seis capítulos y el interludio, dentro del presupuesto de 120 KB |
| Contextos WebGL | 1 |
| Construcción de 44 000 toques | ~110 ms, fuera del hilo principal |
| Movimiento reducido + modo oscuro | Capítulos terminados, sin pin, con fundido |
| Sin WebGL2 | Mensaje en el área; falta la imagen pre-renderizada (Fase 4) |
| Frame en GPU real | **Sin medir.** El entorno de pruebas renderiza por CPU (SwiftShader), así que sus tiempos no valen para la puerta. Hay que medirlo con `?hud` en un Android de gama media y en escritorio. |

En SwiftShader (el peor caso posible, sin GPU) el nivel 1 cuesta algo más de la mitad que el nivel 0 por frame, y el nivel 2 menos de la mitad: la escalera de calidad hace lo que debe.

## Cambios respecto al plan

- **Paletas de pigmentos en JS, no en `--pigmento-palette-*`.** La regla 6 de AGENTS.md prohíbe colores literales en tokens del proyecto. Los pigmentos son datos de la obra y viven en `src/paint/palettes.js`, que leen el shader y las muestras.
- **Raíz a 16 px.** El tema base `example-02` fija la raíz en 14 px; se sobrescribe `--reset-html-font` a `100%` porque la retícula se derivó sobre 16 px y así se respeta el tamaño de letra del usuario.
- **Móvil fija el escenario, no el capítulo.** El capítulo entero no cabe en 100svh con el texto; en móvil se lee el texto y se fija el lienzo a pantalla completa.
