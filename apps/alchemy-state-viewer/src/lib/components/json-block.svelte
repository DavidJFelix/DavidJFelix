<script lang="ts">
const {value}: {value: unknown} = $props()
const text = $derived(JSON.stringify(value, null, 2) ?? 'undefined')
</script>

<pre>{text}</pre>

<style>
  pre {
    margin: 0;
    padding: 0.9rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow-x: auto;
    white-space: pre;
  }
</style>
