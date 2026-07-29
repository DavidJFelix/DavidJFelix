# PandaCSS

This skill's recipes in PandaCSS syntax, for projects styled with Panda. The rules live in the sibling reference files; this file only translates them. Import `css` from the project's generated outdir (usually `styled-system/css`).

## Group with Space

Panda's spacing tokens match the Tailwind scale (`2` = 8px, `4` = 16px, `6` = 24px), so the 2x between-group rule from [grouping-and-alignment.md](grouping-and-alignment.md) is two steps apart:

```tsx
// Good: spacing alone communicates the grouping
<form className={css({display: 'flex', flexDirection: 'column', gap: '6'})}>
  <div className={css({display: 'flex', flexDirection: 'column', gap: '2'})}>...field group...</div>
  <div className={css({display: 'flex', flexDirection: 'column', gap: '2'})}>...field group...</div>
</form>
```

The `stack`/`vstack`/`hstack` patterns from `styled-system/patterns` express the same thing more compactly: `vstack({gap: '2', alignItems: 'stretch'})`.

One-off values (`py: '7px'`, `px: '0.55rem'`) sit off the scale and break the shared rhythm; pick the nearest token, or add a project token if a real new step is needed.

## Logical Properties by Default

Panda's x-axis shorthands are already logical -- `px` is `padding-inline`, `ps`/`pe` are `padding-inline-start`/`-end`, `ms`/`me` the margin equivalents -- so the RTL mirroring rule costs nothing:

```tsx
// Good: one shared leading edge, one indent step
css({ px: '6' })                 // section
css({ ms: '4' })                 // child indent
css({ insetInlineEnd: '4' })     // trailing-edge positioning
```

Never reach for `left`/`right` or `pl`/`pr` for direction-dependent position.

## Safe Areas

```tsx
// Inset action bar
css({
  px: '4',
  paddingBottom: 'calc(token(spacing.4) + env(safe-area-inset-bottom))',
})
```

## Breakpoints Belong to the Content

Conditional values take the place of media queries; the breakpoint fires where the content breaks, not at a device width:

```tsx
css({
  gridTemplateColumns: {base: '1fr', md: 'repeat(2, 1fr)'},
})
```

Project-specific breakpoints are defined once in `theme.breakpoints` in `panda.config.ts`. For component-scoped adaptivity, set `containerType: 'inline-size'` on the wrapper and use an `@container` key in `css()`.

## Full-Bleed Content

The constrained-article grid from [spacing-and-adaptivity.md](spacing-and-adaptivity.md) translates as raw values -- structure like this is fine outside the token system:

```tsx
css({
  display: 'grid',
  gridTemplateColumns: '1fr min(65ch, calc(100% - 48px)) 1fr',
  '& > *': {gridColumn: '2'},
  '& > .full-bleed': {gridColumn: '1 / -1'},
})
```
