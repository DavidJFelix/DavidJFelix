<script lang="ts">
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

{@render children()}
