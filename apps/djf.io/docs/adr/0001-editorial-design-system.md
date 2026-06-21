# 0001 — Editorial-minimal design system on Radix Colors + Panda tokens

- **Status:** Accepted
- **Date:** 2026-06-21
- **Context source:** `grill-with-docs` session on improving djf.io's look and feel

## Context

djf.io had no deliberate design system. `panda.config.ts` was bare (`theme.extend: {}`), so the site
rode entirely on Panda's default preset. Every style was an inline `css({...})` call with hardcoded
`zinc` values; it was dark-only; `@fontsource/inter` was installed but never imported (the body
actually rendered `system-ui`); and the long-form prose styles were hand-written and duplicated
between `BlogPost.astro` and the homepage. The result read as a competent-but-generic developer
default.

The goal is a clean, dressed-down home for technically interesting posts and personal thoughts,
built to grow an audience — a _publication_, not a portfolio.

## Decision

Adopt a **Swiss / editorial-minimal** design language, encoded in the PandaCSS theme spec (not
inline):

1. **Theming:** support light and dark. Default to the system preference (`prefers-color-scheme`);
   add a **persisted manual override toggle** (`localStorage` + an inline no-flash script in
   `<head>`). All colors flow through Panda **semantic tokens**; raw colors are never hardcoded in
   components.
2. **Typography:** **Schibsted Grotesk** (headings/UI), **Inter** (body), **JetBrains Mono** (code),
   self-hosted via `@fontsource`. (Schibsted chosen over Space Grotesk/Geist, which are
   over-exposed.)
3. **Color:** **Radix Colors** — **Olive** neutral + **Grass** accent (a deliberate same-hue
   pairing). Import the official `@radix-ui/colors` values and map the
   `olive / oliveDark / grass / grassDark` (+ alpha) scales **programmatically** into Panda
   `tokens.colors`; layer `semanticTokens.colors` that switch on the `_dark` condition. Follow
   Radix's 1–12 step conventions for the role mapping (see `CONTEXT.md`). Accent stays disciplined —
   links (`grass.11`), focus rings, the toggle, and small marks only.
4. **Single source of truth:** all visual choices live in `panda.config.ts`; this also lets the
   duplicated inline prose styles collapse into a shared recipe/textStyle.

### Rejected alternatives

- **A community Radix-for-Panda preset** — less wiring, but a less-maintained dependency and less
  control. Rejected in favor of mapping the official values ourselves.
- **One-mode-done-well (dark only)** — simpler, but light is the editorial/reading default and
  audience-building wants both.
- **Single neutral sans (pure Swiss) or a sans+serif editorial pairing** — A was less distinctive; C
  (serif body) added weight and screen-rendering care. Chose the grotesk-heading / neutral-body
  middle (B).

## Consequences

- **Positive:** one source of truth; light/dark becomes a values flip; the duplicated prose styling
  collapses; a distinctive, ownable look that avoids the default-zinc/default-Inter dev-blog cliché.
- **Costs:** a theme toggle needs an inline no-flash script and persistence; ongoing discipline to
  never hardcode a color; new deps (`@radix-ui/colors`, three `@fontsource` families).
- **Follow-ups (open):** reading measure / layout, homepage information architecture, prose-style
  consolidation into a recipe, code syntax highlighting.
