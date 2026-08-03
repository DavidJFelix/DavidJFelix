<script lang="ts">
import {badge} from 'styled-system/recipes'
import {statusTone} from '$lib/state'

const {status}: {status: string | undefined} = $props()
const tone = $derived(statusTone(status))
</script>

<span class={badge({tone})}>{status ?? 'unknown'}</span>
