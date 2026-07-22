<script lang="ts">
import type {PageServerData} from './$types'

const {data}: {data: PageServerData} = $props()
</script>

{#if !data.configured}
  <section class="setup">
    <h1>Not connected to a state store</h1>
    <p>
      Point this viewer at your alchemy Cloudflare state store by setting two secrets (see
      <code>.dev.vars.example</code> for local dev):
    </p>
    <pre>wrangler secret put ALCHEMY_STATE_URL
wrangler secret put ALCHEMY_STATE_TOKEN</pre>
    <p>
      <code>ALCHEMY_STATE_URL</code> is the state store worker URL
      (<code>https://alchemy-state-store.&lt;subdomain&gt;.workers.dev</code>);
      <code>ALCHEMY_STATE_TOKEN</code> is the bearer token the alchemy CLI caches under
      <code>~/.alchemy/credentials/&lt;profile&gt;/cloudflare-state-store</code>. Put the deployed
      worker behind Cloudflare Access first -- this app does no authentication of its own.
    </p>
  </section>
{:else}
  <h1>Stacks</h1>
  <p class="meta">reading <code>{data.storeUrl}</code></p>
  {#if data.stacks.length === 0}
    <p class="empty">No stacks found in this state store.</p>
  {:else}
    <ul class="stacks">
      {#each data.stacks as stack (stack.name)}
        <li>
          <h2>{stack.name}</h2>
          {#if stack.stages.length === 0}
            <p class="empty">no stages</p>
          {:else}
            <ul class="stages">
              {#each stack.stages as stage (stage)}
                <li>
                  <a href="/stacks/{encodeURIComponent(stack.name)}/{encodeURIComponent(stage)}">
                    {stage}
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
  }

  .meta {
    color: var(--muted);
    margin: 0 0 1.5rem;
  }

  .empty {
    color: var(--muted);
  }

  .stacks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .stacks > li {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }

  .stacks h2 {
    font-size: 1.05rem;
    margin: 0 0 0.5rem;
  }

  .stages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stages a {
    display: inline-block;
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.85rem;
  }

  .setup {
    max-width: 42rem;
  }

  .setup pre {
    padding: 0.9rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow-x: auto;
  }
</style>
