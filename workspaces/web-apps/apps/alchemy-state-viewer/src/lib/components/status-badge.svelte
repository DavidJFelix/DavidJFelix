<script lang="ts">
import {statusTone} from '#lib/state.ts'
import {badge} from '#styled-system/recipes'

const {status}: {status: string | undefined} = $props()
const tone = $derived(statusTone(status))
</script>

<span class={badge({tone})}>{status ?? 'unknown'}</span>
