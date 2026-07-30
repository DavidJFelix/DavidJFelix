<script lang="ts">
// Tri-state theme switcher for the shared theme contract
// (docs/projects/theme-switcher-unification/plan.md): cycles light -> dark ->
// system, driven by mode-watcher's userPrefersMode/setMode/resetMode. The
// icon and label track the raw preference (not the resolved scheme), so
// "system" on a dark OS still shows the monitor icon.

import {resetMode, setMode, userPrefersMode} from 'mode-watcher'
import {css} from 'styled-system/css'
import {onMount} from 'svelte'

type ThemeMode = 'light' | 'dark' | 'system'

// Cycle order: each press moves to the next mode, so all three states stay
// reachable from a single button (system is never a dead end).
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

// userPrefersMode is a module-level singleton that mode-watcher syncs with
// the persisted "theme" key inside <ModeWatcher>'s onMount, which can run
// after this component's own script does. Gating on a local `mounted` flag
// (rather than reading userPrefersMode.current directly, which mode-watcher
// always resolves to a concrete mode -- "system" by default -- and never
// leaves undefined) keeps the pre-hydration render deterministic: SSR and
// the first client tick both show the neutral fallback instead of racing
// mode-watcher's internal sync.
let mounted = $state(false)
onMount(() => {
  mounted = true
})

const rawMode = $derived<ThemeMode | undefined>(
  mounted ? (userPrefersMode.current as ThemeMode) : undefined,
)
const nextMode = $derived(NEXT_MODE[rawMode ?? 'system'])
const label = $derived(rawMode === undefined ? 'Toggle color theme' : `Switch to ${nextMode} theme`)

function cycle() {
  if (nextMode === 'system') {
    resetMode()
  } else {
    setMode(nextMode)
  }
}

const button = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: '0.45rem',
  borderRadius: '8px',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'surface',
  color: 'text',
  cursor: 'pointer',
  lineHeight: 0,
  outline: 'none',
  transition: 'background-color 0.15s, border-color 0.15s',
  _hover: {bg: 'bg'},
  _focusVisible: {
    outlineWidth: '2px',
    outlineStyle: 'solid',
    outlineColor: 'accent',
    outlineOffset: '2px',
  },
})
</script>

<button type="button" class={button} aria-label={label} title={label} onclick={cycle}>
  {#if rawMode === 'light'}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  {:else if rawMode === 'dark'}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  {:else}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  {/if}
</button>
