<!-- syx:start — written by `npx syx-init` (SYX 5.0.0). Edit outside these markers; `npx syx-init --update` rewrites what is inside. -->
## UI: this project is built on the SYX design system

Every agent and model working on this repository follows these rules for anything that
produces markup, CSS or SCSS. They are binding, not style advice. The full contract is
`node_modules/syx-design-system/CONSUMING.md`; this is its short form.

**SYX is the source of truth. You do not design the UI vocabulary — you look it up.**
Every class, modifier and token you write either comes from SYX or is a deliberate,
justified piece of this project. Writing a name because it *sounds* right is the one
failure this file exists to prevent: it compiles, paints nothing, and nobody is warned.

**Project prefix: `pigmento`** — this project's own classes are `pigmento-*`, its tokens `--pigmento-*`.

### Ask SYX first

Before writing any class or token, query SYX — with the first route you have:

1. MCP tools, if registered (`npx syx-mcp`): `list_components`, `get_component`, `get_token`, `find_token_by_value`, `validate_snippet`.
2. A command: `node -e "console.log(JSON.stringify(require('syx-design-system').getComponent({ name: 'btn' }), null, 1))"`.
3. The file `SYX-VOCABULARY.md` at the root of this repository: every component with its
   block, modifiers, elements and states, every utility and every semantic token.

Not found = does not exist. Never use the closest-looking name; never guess a modifier.

### The loop, for every piece of UI

1. **Look it up** (above).
2. **Reuse, in this order**, and stop at the first that works:
   (a) an existing SYX component; (b) one of its existing modifiers; (c) existing components
   composed in HTML, laid out with `syx-*` utilities or `layout-grid`; (d) an override of an
   existing `--semantic-*` token for the whole project.
3. **Only if a–d fail, create `pigmento-*`** — and write on the line right above its first rule
   which SYX pieces you checked and why they don't fit:
   `/* syx-reuse: checked mol-card, layout-grid — needs a two-column editorial header */`
   The scanner reports a `pigmento-*` block without that line.
4. **Verify**: `npx syx-scan src` (or the files you touched) must show no *alta* or *media*
   findings. If you cannot run it, say so instead of claiming compliance.

### Rules

1. **Never invent a SYX name.** Classes `atom-*`, `mol-*`, `org-*`, `syx-*`, `layout-*` and
   tokens `--primitive-*`, `--semantic-*`, `--component-*`, `--theme-*`, `--layout-*`
   come only from SYX, copied exactly. SYX components have **no** `syx-` prefix
   (`atom-btn`, not ❌ `syx-atm-btn`); `syx-` is only for utilities (`syx-d-flex`).
   Never give this project's pieces a SYX prefix (❌ `org-masthead`): they are `pigmento-*`.
2. **Block + modifier together**: `atom-btn atom-btn--primary`, never the modifier alone.
   Elements one level deep (`mol-card__title`), inside their block.
3. **Never style a SYX class from project CSS** (`.mol-card {…}`, `.pigmento-x .atom-btn {…}`).
   A project class next to a SYX class (or a project selector reaching one, like `.pigmento-x .mol-card__header`)
   may only place it: margin, grid-*, order, align/justify-self, flex-*, width.
4. **Project CSS**: start each stylesheet (in SCSS, right after the `@use` lines) with
   `@layer syx.reset, syx.base, syx.tokens, syx.atoms, syx.molecules, syx.organisms, syx.app, syx.utilities;`
   and put every rule inside `@layer syx.app { … }`. Never `!important`.
5. **Tokens flow one way**: `--semantic-*` → `--pigmento-*` (declared in `:root`, outside any
   layer) → your rules. Rules read only `--pigmento-*`. Never read `--primitive-*` or another
   component's `--component-*`. Never declare a new token under a SYX prefix.
6. **No literal design values in rules**: colours, spacing, radii, fonts and durations are
   tokens. A literal length may only be the value of a `--pigmento-*` token; a colour never.
7. **SCSS**: `@use 'syx-design-system/scss/abstracts/mixins/mixins' as *;` and use the
   mixins for `transition` and `position: absolute|fixed|sticky`. Never `@use` the whole
   `scss/abstracts` (it re-emits SYX's tokens over your theme). Plain CSS: durations and
   easings from `--semantic-duration-*`/`--semantic-easing-*`, plus a
   `prefers-reduced-motion: reduce` opt-out on every transition.
8. **State**: on SYX components, only what they declare (ARIA, native attributes, listed
   `is-*` classes). On `pigmento-*` components: `is-*` or ARIA.

### Names models get wrong

| ❌ Written | ✓ Real |
|---|---|
| ❌ `syx-atm-btn`, `syx-mol-card`, `syx-org-header` | ✓ `atom-btn`, `mol-card`, `org-site-header` |
| ❌ `atom-btn--sm`, `atom-btn--ghost` | ✓ `atom-btn--size-sm`; variants are outlined until you add `atom-btn--filled` |
| ❌ `atom-btn__icon` | ✓ an `atom-icon` inside `atom-btn atom-btn--has-icon` |
| ❌ `--syx-sem-*`, `--syx-cmp-*` | ✓ `--semantic-*`; this project's tokens are `--pigmento-*` |
| ❌ `org-masthead`, `mol-plan-card` (new, in this project) | ✓ `pigmento-masthead`, `pigmento-plan-card` |
| ❌ `@layer atoms`, `@layer components` | ✓ SYX's layers are `syx.*`; project code goes in `syx.app` |
<!-- syx:end -->
