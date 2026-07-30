# PandaCSS

This skill's recipes in PandaCSS syntax, for projects styled with Panda. The rules live in the sibling reference files; this file only translates them. Import `css` from the project's generated outdir (usually `styled-system/css`).

## Type Scale as textStyles

Panda's `textStyles` are the role-based scale from [spacing-and-sizing.md](spacing-and-sizing.md): each role bundles size, line-height, and weight, so a role is one decision instead of three.

```ts
// panda.config.ts
import {defineTextStyles} from '@pandacss/dev'

const textStyles = defineTextStyles({
  display: {value: {fontSize: '2.25rem', lineHeight: '1.1', fontWeight: '600', letterSpacing: '-0.02em'}},
  title: {value: {fontSize: '1.5rem', lineHeight: '1.2', fontWeight: '600'}},
  heading: {value: {fontSize: '1.125rem', lineHeight: '1.3', fontWeight: '600'}},
  body: {value: {fontSize: '1rem', lineHeight: '1.5', fontWeight: '400'}},
  caption: {value: {fontSize: '0.8125rem', lineHeight: '1.4', fontWeight: '400'}},
})
```

```tsx
css({ textStyle: 'title' })
```

Map heading levels to descending steps centrally -- `globalCss` in `panda.config.ts` (`h1: {textStyle: 'display'}, h2: {textStyle: 'title'}, ...`) -- rather than restyling per component. Heading semantics belong to `better-accessibility`.

## Measure and Wrapping

```tsx
css({
  maxWidth: '65ch', // or the project's container token in the 60-75 character range
  textWrap: 'pretty',
})
```

`textWrap: 'balance'` on headings, `'pretty'` on descriptions, neither in long-form text -- same rules as [wrapping-and-punctuation.md](wrapping-and-punctuation.md).

## Truncation

Panda ships both forms as utilities:

```tsx
css({ truncate: true }) // single line: overflow, nowrap, ellipsis in one prop
css({ lineClamp: 3 })   // multi-line clamp
```

Truncation hides content; the full-value affordance rule in [wrapping-and-punctuation.md](wrapping-and-punctuation.md) still applies.

## Tabular Numbers

```tsx
css({ fontVariantNumeric: 'tabular-nums' })
```

## Labels

```tsx
// Small uppercase labels need positive tracking
css({ textTransform: 'uppercase', letterSpacing: '0.05em' })
```

Fonts themselves (families, weights, formats) are declared per app -- self-hosted files plus a `fonts` token with a real fallback stack (`system-ui, sans-serif`), never a bare `fontFamily: 'sans'` that falls through to the preset default.
