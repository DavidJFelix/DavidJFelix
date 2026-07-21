<script lang="ts">
import JsonBlock from '$lib/components/json-block.svelte'
import StatusBadge from '$lib/components/status-badge.svelte'
import {isAction, typeOf} from '$lib/state'
import type {PageServerData} from './$types'

const {data}: {data: PageServerData} = $props()

const resourceHref = (fqn: string): string =>
  `/stacks/${encodeURIComponent(data.stack)}/${encodeURIComponent(data.stage)}/resources/${encodeURIComponent(fqn)}`
</script>

<svelte:head>
  <title>{data.stack} / {data.stage} - alchemy state</title>
</svelte:head>

<nav class="crumbs">
  <a href="/">stacks</a>
  <span>/</span>
  <span>{data.stack}</span>
  <span>/</span>
  <strong>{data.stage}</strong>
</nav>

<h1>{data.stack} <span class="stage">@ {data.stage}</span></h1>

{#if data.counts.length > 0}
  <p class="summary">
    {#each data.counts as [status, count] (status)}
      <span class="count"><StatusBadge {status} /> {count}</span>
    {/each}
  </p>
{/if}

{#if data.resources.length === 0}
  <p class="empty">No resources in this stage.</p>
{:else}
  <table>
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
              <span class="kind">action</span>
            {/if}
          </td>
          <td><StatusBadge status={resource.state?.status} /></td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if data.output !== undefined}
  <section>
    <h2>Stack output</h2>
    <JsonBlock value={data.output} />
  </section>
{/if}

<style>
  .crumbs {
    display: flex;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.75rem;
  }

  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.75rem;
  }

  .stage {
    color: var(--muted);
    font-weight: 400;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0 0 1.25rem;
  }

  .count {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .empty {
    color: var(--muted);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  th,
  td {
    text-align: left;
    padding: 0.55rem 0.9rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
  }

  th {
    color: var(--muted);
    font-weight: 500;
    font-size: 0.8rem;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .kind {
    margin-left: 0.4rem;
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  section {
    margin-top: 2rem;
  }

  h2 {
    font-size: 1.05rem;
    margin: 0 0 0.6rem;
  }
</style>
