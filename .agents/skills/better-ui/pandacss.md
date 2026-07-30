# PandaCSS

This skill's recipes in PandaCSS syntax, for projects styled with Panda. The rules live in the sibling reference files; this file only translates them. Import `css` from the project's generated outdir (usually `styled-system/css`).

## Transition Only What Changes

Panda's `transition` utility accepts bundles (`colors`, `opacity`, `shadow`, `transform`, `common`) that expand to a curated property list with duration and easing -- prefer those, or name the exact properties. `transition: 'all'` type-checks; never use it.

```tsx
// Good: only transition what changes
css({
  transitionProperty: 'scale, background-color',
  transitionDuration: '150ms',
  transitionTimingFunction: 'ease-out',
})

// Good: the curated bundle when only colors change
css({ transition: 'colors' })

// Bad: transition everything
css({ transition: 'all 150ms ease-out' })
```

## Scale on Press

```tsx
css({
  transitionProperty: 'scale',
  transitionDuration: '150ms',
  transitionTimingFunction: 'ease-out',
  _active: { scale: '0.96' },
})
```

## Concentric Border Radius

Panda's radii tokens match the Tailwind values, so the same pairs work: outer `2xl` (16px) with padding `2` (8px) makes the inner radius `lg` (8px).

```tsx
// Good: outer radius accounts for padding
<div className={css({borderRadius: '2xl', padding: '2'})}>
  <div className={css({borderRadius: 'lg'})}>...</div>
</div>
```

For arbitrary tokens, compute it with `token()`: `borderRadius: 'calc(token(radii.lg) + token(spacing.2))'`.

## Optical Alignment

Panda's x-axis shorthands are logical by default, so the icon-side trim from [surfaces.md](surfaces.md) is direct:

```tsx
// Trailing icon side = text side - 2px
<button className={css({ps: '4', pe: '3.5', display: 'flex', alignItems: 'center', gap: '2'})}>
  <span>Continue</span>
  <ArrowRightIcon />
</button>
```

## Keyframes and Stagger

Keyframes are defined once in `panda.config.ts` and referenced by name; reserve them for one-shot sequences per [animations.md](animations.md).

```ts
// panda.config.ts
theme: {
  extend: {
    keyframes: {
      fadeInUp: {
        to: { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
      },
    },
  },
},
```

```tsx
css({
  opacity: 0,
  transform: 'translateY(12px)',
  filter: 'blur(4px)',
  animation: 'fadeInUp 400ms ease-out forwards',
  '&:nth-child(2)': { animationDelay: '100ms' },
  '&:nth-child(3)': { animationDelay: '200ms' },
})
```

Reduced-motion requirements for any animation belong to `better-accessibility` (`_motionSafe` / `_motionReduce`).

## will-change

`css({willChange: 'transform'})` -- same property rules as [performance.md](performance.md): compositor-friendly properties only, added only when first-frame stutter is observed.
