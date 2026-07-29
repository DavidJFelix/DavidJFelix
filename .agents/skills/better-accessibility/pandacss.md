# PandaCSS

This skill's recipes in PandaCSS syntax, for projects styled with Panda. The rules live in the sibling reference files; this file only translates them. Import `css` from the project's generated outdir (usually `styled-system/css`).

## Condition map

| CSS | Panda condition |
| --- | --- |
| `:focus-visible` | `_focusVisible` |
| `@media (prefers-reduced-motion: no-preference)` | `_motionSafe` |
| `@media (prefers-reduced-motion: reduce)` | `_motionReduce` |
| `@media (prefers-contrast: more)` | `_moreContrast` |
| `@media (forced-colors: active)` | `_highContrast` |
| `::after` / `::before` | `_after` / `_before` |

## Focus rings

```tsx
// Use the project's focus token or established focus-ring utility
<button
  className={css({
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'focus.ring',
      outlineOffset: '2px',
    },
  })}
>
  Save
</button>
```

When buttons come from a `defineRecipe` in `panda.config.ts`, put `_focusVisible` in the recipe `base` so every variant inherits it; a variant-level hover state without a base-level focus ring is the most common gap.

## Motion is opt-in

```tsx
// Good: transition only exists when the user allows motion
css({
  _motionSafe: { transition: 'transform 200ms ease-out' },
})
```

The global kill-switch fallback for an existing codebase belongs in `globalCss` in `panda.config.ts`, keeping the `0.01ms` values from [motion-and-zoom.md](motion-and-zoom.md) so `transitionend` still fires.

## Expanded hit areas

```tsx
// Small checkbox with an expanded 44px hit area, on the wrapping label
css({
  position: 'relative',
  width: '5',
  height: '5',
  _after: {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%', // physical centering: direction-independent
    transform: 'translate(-50%, -50%)',
    width: '11',
    height: '11',
  },
})
```

The layout alternative maps directly: `css({minWidth: '11', minHeight: '11', display: 'inline-grid', placeItems: 'center'})`.

## Visually hidden content

Panda ships the utility: `css({srOnly: true})` generates the full visually-hidden rule set; no hand-rolled clip-path block. The rules for when hidden text is required live in [screen-readers.md](screen-readers.md).
