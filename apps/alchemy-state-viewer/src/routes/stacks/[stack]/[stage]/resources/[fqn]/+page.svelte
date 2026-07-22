<script lang="ts">
import {css} from 'styled-system/css'
import StateSection from '$lib/components/state-section.svelte'
import StatusBadge from '$lib/components/status-badge.svelte'
import {isAction, typeOf} from '$lib/state'
import type {PageServerData} from './$types'

const {data}: {data: PageServerData} = $props()

const stageHref = $derived(
  `/stacks/${encodeURIComponent(data.stack)}/${encodeURIComponent(data.stage)}`,
)
const action = $derived(isAction(data.state))

const crumbs = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  fontSize: '0.85rem',
  color: 'muted',
  mb: '0.75rem',
})

const title = css({fontSize: '1.25rem', m: 0, mb: '1rem', overflowWrap: 'anywhere'})

const overview = css({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '0.35rem 1.25rem',
  m: 0,
  mb: '1.5rem',
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '8px',
  px: '1.25rem',
  py: '1rem',
  '& dt': {
    color: 'muted',
    fontSize: '0.85rem',
  },
  '& dd': {
    m: 0,
    fontSize: '0.9rem',
  },
})

const kind = css({
  ms: '0.5rem',
  fontSize: '0.7rem',
  color: 'muted',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const downstreamSection = css({mt: '1.5rem'})
const downstreamHeading = css({fontSize: '1rem', m: 0, mb: '0.6rem'})
const downstreamList = css({listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '0.35rem'})
</script>

<svelte:head>
  <title>{data.fqn} - alchemy state</title>
</svelte:head>

<nav class={crumbs}>
  <a href="/">stacks</a>
  <span>/</span>
  <a href={stageHref}>{data.stack} @ {data.stage}</a>
  <span>/</span>
  <strong>{data.fqn}</strong>
</nav>

<h1 class={title}><code>{data.fqn}</code></h1>

<dl class={overview}>
  <dt>Type</dt>
  <dd><code>{typeOf(data.state)}</code>{#if action}<span class={kind}>action</span>{/if}</dd>
  <dt>Status</dt>
  <dd><StatusBadge status={data.state.status} /></dd>
  {#if data.state.logicalId !== undefined}
    <dt>Logical ID</dt>
    <dd><code>{data.state.logicalId}</code></dd>
  {/if}
  {#if data.state.instanceId !== undefined}
    <dt>Instance ID</dt>
    <dd><code>{data.state.instanceId}</code></dd>
  {/if}
  {#if data.state.providerVersion !== undefined}
    <dt>Provider version</dt>
    <dd>{data.state.providerVersion}</dd>
  {/if}
  {#if data.state.inputHash !== undefined}
    <dt>Input hash</dt>
    <dd><code>{data.state.inputHash}</code></dd>
  {/if}
</dl>

{#if data.state.props !== undefined}
  <StateSection title="Props" hint="desired state" value={data.state.props} />
{/if}

{#if data.state.attr !== undefined}
  <StateSection title="Attributes" hint="current state" value={data.state.attr} />
{/if}

{#if data.state.input !== undefined}
  <StateSection title="Input" value={data.state.input} />
{/if}

{#if data.state.output !== undefined}
  <StateSection title="Output" value={data.state.output} />
{/if}

{#if data.state.old !== undefined}
  <StateSection title="Old" hint="pre-update / replaced state" value={data.state.old} />
{/if}

{#if data.state.bindings !== undefined && data.state.bindings.length > 0}
  <StateSection title="Bindings" value={data.state.bindings} />
{/if}

{#if data.state.downstream !== undefined && data.state.downstream.length > 0}
  <section class={downstreamSection}>
    <h2 class={downstreamHeading}>Downstream</h2>
    <ul class={downstreamList}>
      {#each data.state.downstream as fqn (fqn)}
        <li>
          <a href="{stageHref}/resources/{encodeURIComponent(fqn)}"><code>{fqn}</code></a>
        </li>
      {/each}
    </ul>
  </section>
{/if}
