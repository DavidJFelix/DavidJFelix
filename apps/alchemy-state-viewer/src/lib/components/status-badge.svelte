<script lang="ts">
import {statusTone} from '$lib/state'

const {status}: {status: string | undefined} = $props()
const tone = $derived(statusTone(status))
</script>

<span class="badge {tone}">{status ?? 'unknown'}</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .ok {
    color: var(--ok);
    background: var(--ok-bg);
  }

  .busy {
    color: var(--busy);
    background: var(--busy-bg);
  }

  .warn {
    color: var(--warn);
    background: var(--warn-bg);
  }

  .unknown {
    color: var(--muted);
    background: var(--unknown-bg);
  }
</style>
