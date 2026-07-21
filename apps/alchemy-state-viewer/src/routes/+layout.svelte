<script lang="ts">
import type {Snippet} from 'svelte'

const {children}: {children: Snippet} = $props()
</script>

<svelte:head>
  <title>alchemy state</title>
</svelte:head>

<div class="shell">
  <header>
    <a class="brand" href="/">alchemy state</a>
  </header>
  <main>
    {@render children()}
  </main>
</div>

<style>
  :global(:root) {
    color-scheme: light dark;
    --bg: light-dark(#fafaf8, #16181d);
    --surface: light-dark(#ffffff, #1e2128);
    --border: light-dark(#e4e4e0, #2c3038);
    --text: light-dark(#26282c, #d8dade);
    --muted: light-dark(#71747c, #8b8f99);
    --accent: light-dark(#5b4a8f, #a795e0);
    --ok: light-dark(#1a7f4b, #4cc38a);
    --ok-bg: light-dark(#e6f5ec, #14301f);
    --busy: light-dark(#946200, #e0b45c);
    --busy-bg: light-dark(#fdf3dd, #33270e);
    --warn: light-dark(#a13a2f, #e08579);
    --warn-bg: light-dark(#fbe9e6, #331713);
    --unknown-bg: light-dark(#ededeb, #262a31);
  }

  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, sans-serif;
    line-height: 1.5;
  }

  :global(a) {
    color: var(--accent);
    text-decoration: none;
  }

  :global(a:hover) {
    text-decoration: underline;
  }

  :global(code),
  :global(pre) {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.85rem;
  }

  .shell {
    max-width: 60rem;
    margin: 0 auto;
    padding: 0 1.25rem 4rem;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1.5rem;
  }

  .brand {
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--text);
  }
</style>
