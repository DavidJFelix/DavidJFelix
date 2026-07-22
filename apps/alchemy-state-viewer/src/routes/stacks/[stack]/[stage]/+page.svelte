<script lang="ts">
import {css} from 'styled-system/css'
import JsonView from '$lib/components/json-view.svelte'
import StatusBadge from '$lib/components/status-badge.svelte'
import {isAction, typeOf} from '$lib/state'
import type {PageServerData} from './$types'

const {data}: {data: PageServerData} = $props()

const resourceHref = (fqn: string): string =>
  `/stacks/${encodeURIComponent(data.stack)}/${encodeURIComponent(data.stage)}/resources/${encodeURIComponent(fqn)}`

const crumbs = css({
  display: 'flex',
  gap: '0.4rem',
  fontSize: '0.85rem',
  color: 'muted',
  mb: '0.75rem',
})

const title = css({fontSize: '1.4rem', m: 0, mb: '0.75rem'})
const stage = css({color: 'muted', fontWeight: '400'})

const summary = css({display: 'flex', flexWrap: 'wrap', gap: '0.75rem', m: 0, mb: '1.25rem'})

const count = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.85rem',
  color: 'muted',
})

const empty = css({color: 'muted'})

const table = css({
  w: '100%',
  borderCollapse: 'collapse',
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '8px',
  '& th, & td': {
    textAlign: 'left',
    px: '0.9rem',
    py: '0.55rem',
    borderBottomWidth: '1px',
    borderColor: 'border',
    fontSize: '0.9rem',
  },
  '& th': {
    color: 'muted',
    fontWeight: '500',
    fontSize: '0.8rem',
  },
  '& tbody tr:last-child td': {
    borderBottomWidth: 0,
  },
})

const kind = css({
  ms: '0.4rem',
  fontSize: '0.7rem',
  color: 'muted',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const outputSection = css({mt: '2rem'})
const outputHeading = css({fontSize: '1.05rem', m: 0, mb: '0.6rem'})
</script>

<svelte:head>
  <title>{data.stack} / {data.stage} - alchemy state</title>
</svelte:head>

<nav class={crumbs}>
  <a href="/">stacks</a>
  <span>/</span>
  <span>{data.stack}</span>
  <span>/</span>
  <strong>{data.stage}</strong>
</nav>

<h1 class={title}>{data.stack} <span class={stage}>@ {data.stage}</span></h1>

{#if data.counts.length > 0}
  <p class={summary}>
    {#each data.counts as [status, n] (status)}
      <span class={count}><StatusBadge {status} /> {n}</span>
    {/each}
  </p>
{/if}

{#if data.resources.length === 0}
  <p class={empty}>No resources in this stage.</p>
{:else}
  <table class={table}>
    <thead>
      <tr>
        <th>Resource</th>
        <th>Type</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {#each data.resources as resource (resource.fqn)}
        <tr>
          <td><a href={resourceHref(resource.fqn)}><code>{resource.fqn}</code></a></td>
          <td>
            <code>{resource.state === undefined ? '?' : typeOf(resource.state)}</code>
            {#if resource.state !== undefined && isAction(resource.state)}
              <span class={kind}>action</span>
            {/if}
          </td>
          <td><StatusBadge status={resource.state?.status} /></td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if data.output !== undefined}
  <section class={outputSection}>
    <h2 class={outputHeading}>Stack output</h2>
    <JsonView value={data.output} />
  </section>
{/if}
