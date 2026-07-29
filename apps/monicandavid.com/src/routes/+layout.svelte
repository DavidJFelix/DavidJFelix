<script lang="ts">
import {ModeWatcher} from 'mode-watcher'
import {onMount} from 'svelte'
import '../app.css'
import {initClientObservability} from '../observability/client'

let {children} = $props()

// onMount runs in the browser only, so the SDKs never load during SSR/prerender.
// Each integration stays dark until its VITE_PUBLIC_* var is set at build; both
// ride the same-origin relay served by the /diag and /bugs endpoints.
onMount(() => {
  initClientObservability()
})
</script>

<!-- Shared theme-switcher contract (docs/projects/theme-switcher-unification/plan.md):
     localStorage key "theme", light/dark/system class on <html>, no themeColors
     (verified bug in system mode). -->
<ModeWatcher modeStorageKey="theme" defaultMode="system" darkClassNames={['dark']} lightClassNames={['light']} />

{@render children()}
