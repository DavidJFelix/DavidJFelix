# PandaCSS

This skill's recipes in PandaCSS syntax, for projects styled with Panda. The rules live in the sibling reference files; this file only translates them.

## OKLCH Scales as Tokens

The raw palette from [palette-generation.md](palette-generation.md) goes in `theme.tokens.colors`; every value stays `oklch()`.

```ts
// panda.config.ts
import {defineTokens} from '@pandacss/dev'

const colors = defineTokens.colors({
  blue: {
    50: {value: 'oklch(0.971 0.012 250)'},
    500: {value: 'oklch(0.623 0.188 250)'},
    950: {value: 'oklch(0.215 0.048 250)'},
  },
})
```

## Semantic Tokens over Raw Values

Role tokens with appearance variants live in `theme.semanticTokens.colors`; components reference the role, never the raw step. This replaces both hand-written `--color-*` variables and `light-dark()` pairs scattered through components.

```ts
import {defineSemanticTokens} from '@pandacss/dev'

const semanticColors = defineSemanticTokens.colors({
  text: {
    primary: {value: {base: '{colors.blue.950}', _osDark: '{colors.blue.50}'}},
    secondary: {value: {base: 'oklch(0.552 0.016 285.938)', _osDark: 'oklch(0.705 0.015 286.067)'}},
  },
  surface: {value: {base: 'oklch(1 0 0)', _osDark: 'oklch(0.141 0.005 285.823)'}},
  accent: {
    value: {
      base: 'oklch(0.623 0.188 259.815)',
      _osDark: 'oklch(0.707 0.165 254.624)',
      _moreContrast: 'oklch(0.488 0.243 264.376)',
    },
  },
})
```

```tsx
css({ color: 'text.secondary', background: 'surface' })
```

`_osDark` follows the OS setting; a class-toggled theme instead defines a custom condition (e.g. `dark: '.dark &'`) in `conditions` and uses `_dark`. Either way the swap-then-tune rule from [palette-generation.md](palette-generation.md) applies: dark values are tuned per pair, not mechanically mirrored, and every pair is rechecked in both appearances per [accessibility-contrast.md](accessibility-contrast.md).

## One Meaning per Token

Status and category colors get their own semantic tokens (`success`, `destructive`, and so on) instead of hex values inlined at the call site; a hardcoded `#07c480` beside a token system is the failure mode [color-usage.md](color-usage.md) describes.
