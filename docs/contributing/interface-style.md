# Interface style

The interface rulebook lives in the seven vendored `better-*` skills under
[.agents/skills/](../../.agents/skills/), from Jakub Krehel's
[skills collection](https://github.com/jakubkrehel/skills). This guide says how to use them here; it
deliberately restates none of their rules, because each rule lives in exactly one skill.

## Domain ownership

One skill owns each concern; when domains overlap, the owner decides and the neighbor hands off.

| Skill                  | Owns                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| `better-accessibility` | Semantics, keyboard and focus behavior, accessible names, forms, motion |
| `better-layout`        | Grouping, alignment, spacing, reading order, responsive structure       |
| `better-writing`       | Interface copy -- labels, errors, empty states, voice and tone          |
| `better-typography`    | Fonts, type scale, line-height, wrapping, truncation                    |
| `better-colors`        | OKLCH palettes, contrast measurement, gamut, theming                    |
| `better-ui`            | Visual polish -- surfaces, icons, motion -- after interaction is sound  |
| `better-interface`     | The user-invoked review that coordinates the other six                  |

## Using them

- The six domain skills fire from context during any UI work; write and review interface code with
  the owning skill's principles applied.
- `/better-interface [quick|full] [scope]` runs the consolidated cross-discipline review -- one
  ranked findings table with evidence, not six stapled reports. Reach for it before shipping a new
  screen or flow.
- The skills adapt to each app's existing styling system (PandaCSS tokens, Tailwind, plain CSS);
  they never impose one. Reuse the app's tokens and scales before inventing values, per the
  `design-reviewer` persona's consistency rubric.

## Vendoring

The `better-*` skill folders are vendored third-party content: received under MIT, offered under the
repo's dual license with the retained notice in
[.agents/skills/NOTICE.md](../../.agents/skills/NOTICE.md), and content-pinned in the repo-root
`skills-lock.json`. Treat them as read-only -- improvements go upstream, and any deliberate local
edit must recompute the folder hash in the lockfile in the same PR.
