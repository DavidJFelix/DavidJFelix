<script lang="ts">
import {ogTags} from '@davidjfelix/og'
import {css} from 'styled-system/css'
import type {PageServerData} from './$types'

const socialTags = ogTags({title: 'alchemy state', type: 'website'})

const {data}: {data: PageServerData} = $props()

const title = css({fontSize: '[1.4rem]', m: '0', mb: '1'})
const meta = css({color: 'muted', m: '0', mb: '6'})
const empty = css({color: 'muted'})

const stackList = css({listStyle: 'none', m: '0', p: '0', display: 'grid', gap: '4'})

const stackCard = css({
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '[8px]',
  px: '5',
  py: '4',
})

const stackName = css({fontSize: '[1.05rem]', m: '0', mb: '2'})

const stageList = css({
  listStyle: 'none',
  m: '0',
  p: '0',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2',
})

const stageChip = css({
  display: 'inline-block',
  px: '[0.7rem]',
  py: '[0.2rem]',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: 'full',
  fontSize: '[0.85rem]',
})

const setup = css({maxW: '2xl'})

const setupCode = css({
  px: '4',
  py: '[0.9rem]',
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '[8px]',
  overflowX: 'auto',
})
</script>

<svelte:head>
  <title>alchemy state</title>
  {#each socialTags as tag (tag)}
    <meta {...tag} />
  {/each}
</svelte:head>

{#if !data.configured}
  <section class={setup}>
    <h1 class={title}>Not connected to a state store</h1>
    <p>
      This viewer is configured entirely in <code>wrangler.toml</code>: the
      <code>ALCHEMY_STATE_URL</code> var points at the state store worker
      (<code>https://alchemy-state-store.&lt;subdomain&gt;.workers.dev</code>) and the bearer token
      is read through the <code>ALCHEMY_STATE_TOKEN_SECRET</code> Secrets Store binding. Seeing
      this page means the URL var is unset or blank here. For local dev, set
      <code>ALCHEMY_STATE_TOKEN</code> in <code>.dev.vars</code> (see
      <code>.dev.vars.example</code>).
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
