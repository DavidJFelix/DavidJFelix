<script lang="ts">
import {ModeWatcher} from 'mode-watcher'
import {css} from 'styled-system/css'
import type {Snippet} from 'svelte'
import ThemeToggle from '$lib/components/theme-toggle.svelte'
import '../app.css'

const {children}: {children: Snippet} = $props()

const shell = css({maxW: '60rem', mx: 'auto', px: '1.25rem', pb: '4rem'})

const header = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '1rem',
  py: '1.25rem',
  borderBottomWidth: '1px',
  borderColor: 'border',
  mb: '1.5rem',
})

const brand = css({fontWeight: '600', letterSpacing: '0.01em', color: 'text'})
</script>

<!-- Shared theme-switcher contract (docs/projects/theme-switcher-unification/plan.md):
     localStorage key "theme", light/dark/system class on <html>, no themeColors
     (verified bug in system mode). -->
<ModeWatcher modeStorageKey="theme" defaultMode="system" darkClassNames={['dark']} lightClassNames={['light']} />

<div class={shell}>
  <header class={header}>
    <a class={brand} href="/">alchemy state</a>
    <ThemeToggle />
  </header>
  <main>
    {@render children()}
  </main>
</div>
