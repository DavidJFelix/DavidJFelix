<script lang="ts">
import {css} from 'styled-system/css'
import type {PageServerData} from './$types'

const {data}: {data: PageServerData} = $props()

const title = css({fontSize: '1.4rem', m: 0, mb: '0.25rem'})
const meta = css({color: 'muted', m: 0, mb: '1.5rem'})
const empty = css({color: 'muted'})

const stackList = css({listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '1rem'})

const stackCard = css({
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '8px',
  px: '1.25rem',
  py: '1rem',
})

const stackName = css({fontSize: '1.05rem', m: 0, mb: '0.5rem'})

const stageList = css({
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
})

const stageChip = css({
  display: 'inline-block',
  px: '0.7rem',
  py: '0.2rem',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: 'full',
  fontSize: '0.85rem',
})

const setup = css({maxW: '42rem'})

const setupCode = css({
  px: '1rem',
  py: '0.9rem',
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '8px',
  overflowX: 'auto',
})
</script>

{#if !data.configured}
  <section class={setup}>
    <h1 class={title}>Not connected to a state store</h1>
    <p>
      Point this viewer at your alchemy Cloudflare state store by setting two secrets (see
      <code>.dev.vars.example</code> for local dev):
    </p>
    <pre class={setupCode}>wrangler secret put ALCHEMY_STATE_URL
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
  <h1 class={title}>Stacks</h1>
  <p class={meta}>reading <code>{data.storeUrl}</code></p>
  {#if data.stacks.length === 0}
    <p class={empty}>No stacks found in this state store.</p>
  {:else}
    <ul class={stackList}>
      {#each data.stacks as stack (stack.name)}
        <li class={stackCard}>
          <h2 class={stackName}>{stack.name}</h2>
          {#if stack.stages.length === 0}
            <p class={empty}>no stages</p>
          {:else}
            <ul class={stageList}>
              {#each stack.stages as stage (stage)}
                <li>
                  <a
                    class={stageChip}
                    href="/stacks/{encodeURIComponent(stack.name)}/{encodeURIComponent(stage)}"
                  >
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
