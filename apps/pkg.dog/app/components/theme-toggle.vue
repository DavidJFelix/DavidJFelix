<script setup lang="ts">
import {css} from 'styled-system/css'

type ThemeMode = 'light' | 'dark' | 'system'

// Cycle order: each press moves to the next mode, so all three states stay
// reachable from a single button (system is never a dead end). Mirrors
// apps/f311x/src/theme/theme-toggle.tsx's semantics for the repo-wide
// theme-switcher contract.
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

// useColorMode() is auto-imported by @nuxtjs/color-mode (nuxt.config.ts).
const colorMode = useColorMode()

// While colorMode.unknown is true (SSR / before the client plugin confirms
// the resolved preference on app:mounted), the raw mode isn't settled yet --
// the label and icon fall back to the generic "toggle" state rather than
// guessing, matching f311x's pre-hydration gate.
const mode = computed(() => (colorMode.unknown ? undefined : (colorMode.preference as ThemeMode)))
const label = computed(() =>
  mode.value === undefined ? 'Toggle color theme' : `Switch to ${NEXT_MODE[mode.value]} theme`,
)

function handleClick() {
  colorMode.preference = NEXT_MODE[mode.value ?? 'system']
}

const buttonClass = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '10',
  height: '10',
  rounded: 'md',
  color: 'text',
  cursor: 'pointer',
  _hover: {bg: 'border'},
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'currentcolor',
    outlineOffset: '2px',
  },
})
const iconClass = css({width: '4.5', height: '4.5'})
</script>

<template>
  <button
    type="button"
    :class="buttonClass"
    :aria-label="label"
    :title="label"
    @click="handleClick"
  >
    <svg
      v-if="mode === 'light'"
      :class="iconClass"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
      />
    </svg>
    <svg
      v-else-if="mode === 'dark'"
      :class="iconClass"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
    <svg
      v-else
      :class="iconClass"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  </button>
</template>
