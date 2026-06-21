<script lang="ts">
import {onMount} from 'svelte'
import '../app.css'
import {initClientObservability} from '../observability/client'

let {children} = $props()

// onMount runs in the browser only, so the SDKs never load during SSR/prerender.
onMount(() => {
  initClientObservability()
})
</script>

{@render children()}
