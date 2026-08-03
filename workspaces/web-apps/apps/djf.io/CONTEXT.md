# djf.io — Context

Personal site and blog for David J Felix (`apps/djf.io`). Astro + MDX + PandaCSS + React, deployed
on Cloudflare.

**Goal:** a clean, _dressed-down_ home for technically interesting posts and personal thoughts,
built to grow an audience. Not a portfolio; a publication.

## Design language

The visual direction, decided during a `grill-with-docs` session (see
[docs/adr/0001-editorial-design-system.md](docs/adr/0001-editorial-design-system.md)):

- **Direction — Swiss / editorial-minimal.** "Dressed-down but authored": nothing decorative; the
  craft lives in typography, spacing, and hierarchy. Every type size, weight, and margin is
  deliberate so the site reads as _chosen_, not scaffolded.
- **Theming — light + dark.** System default (`prefers-color-scheme`) with a **persisted manual
  override toggle**. Built entirely on Panda **semantic tokens** — components never hardcode a raw
  color.
- **Type — Schibsted Grotesk (headings/UI) + Inter (body) + JetBrains Mono (code).** Self-hosted via
  `@fontsource`. The grotesk heading carries the voice; Inter recedes for comfortable reading.
- **Color — Radix Colors: Olive neutral + Grass accent.** A same-hue pairing (Radix grays are
  designed to sit under a matching accent), so it reads cohesive and lightly organic without being
  _warm_. The accent is **disciplined** — links, focus rings, the theme toggle, small marks only;
  never large fills.

### Ubiquitous language — semantic color tokens

Components reference these roles, never raw scales. Each resolves light → dark automatically (Radix
step in parentheses; dark uses the `*Dark` scale):

| Token           | Role                                  | Olive/Grass step |
| --------------- | ------------------------------------- | ---------------- |
| `bg.canvas`     | page background                       | olive.1          |
| `bg.subtle`     | section tint                          | olive.2          |
| `bg.element`    | cards, pills (hover: olive.4)         | olive.3          |
| `border.subtle` | separators                            | olive.6          |
| `border`        | borders, focus base                   | olive.7          |
| `text.muted`    | meta, captions                        | olive.11         |
| `text.default`  | body + headings                       | olive.12         |
| `accent.solid`  | solid marks/buttons (hover: grass.10) | grass.9          |
| `accent.text`   | **links**, text accents               | grass.11         |
| `focus.ring`    | keyboard focus                        | grass.8          |

Radix **alpha** scales (`oliveA`, `grassA`) back borders/overlays so they composite cleanly on any
background.

## Status / open threads

In-flight redesign (`grill-with-docs` → PRD pending). Still open at last checkpoint: layout &
reading measure, homepage information architecture, prose-style consolidation, syntax highlighting.
See `docs/projects/` once a plan lands.
