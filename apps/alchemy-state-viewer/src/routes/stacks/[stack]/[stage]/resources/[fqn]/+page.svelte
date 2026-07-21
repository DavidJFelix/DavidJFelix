<script lang="ts">
import JsonBlock from '$lib/components/json-block.svelte'
import StatusBadge from '$lib/components/status-badge.svelte'
import {isAction, typeOf} from '$lib/state'
import type {PageServerData} from './$types'

const {data}: {data: PageServerData} = $props()

const stageHref = $derived(
  `/stacks/${encodeURIComponent(data.stack)}/${encodeURIComponent(data.stage)}`,
)
const action = $derived(isAction(data.state))
</script>

<svelte:head>
  <title>{data.fqn} - alchemy state</title>
</svelte:head>

<nav class="crumbs">
  <a href="/">stacks</a>
  <span>/</span>
  <a href={stageHref}>{data.stack} @ {data.stage}</a>
  <span>/</span>
  <strong>{data.fqn}</strong>
</nav>

<h1><code>{data.fqn}</code></h1>

<dl class="overview">
  <dt>Type</dt>
  <dd><code>{typeOf(data.state)}</code>{#if action}<span class="kind">action</span>{/if}</dd>
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
  <section>
    <h2>Props <span class="hint">desired state</span></h2>
    <JsonBlock value={data.state.props} />
  </section>
{/if}

{#if data.state.attr !== undefined}
  <section>
    <h2>Attributes <span class="hint">current state</span></h2>
    <JsonBlock value={data.state.attr} />
  </section>
{/if}

{#if data.state.input !== undefined}
  <section>
    <h2>Input</h2>
    <JsonBlock value={data.state.input} />
  </section>
{/if}

{#if data.state.output !== undefined}
  <section>
    <h2>Output</h2>
    <JsonBlock value={data.state.output} />
  </section>
{/if}

{#if data.state.old !== undefined}
  <section>
    <h2>Old <span class="hint">pre-update / replaced state</span></h2>
    <JsonBlock value={data.state.old} />
  </section>
{/if}

{#if data.state.bindings !== undefined && data.state.bindings.length > 0}
  <section>
    <h2>Bindings</h2>
    <JsonBlock value={data.state.bindings} />
  </section>
{/if}

{#if data.state.downstream !== undefined && data.state.downstream.length > 0}
  <section>
    <h2>Downstream</h2>
    <ul class="downstream">
      {#each data.state.downstream as fqn (fqn)}
        <li>
          <a href="{stageHref}/resources/{encodeURIComponent(fqn)}"><code>{fqn}</code></a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.75rem;
  }

  h1 {
    font-size: 1.25rem;
    margin: 0 0 1rem;
    overflow-wrap: anywhere;
  }

  .overview {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.35rem 1.25rem;
    margin: 0 0 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }

  dt {
    color: var(--muted);
    font-size: 0.85rem;
  }

  dd {
    margin: 0;
    font-size: 0.9rem;
  }

  .kind {
    margin-left: 0.5rem;
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  section {
    margin-top: 1.5rem;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 0.6rem;
  }

  .hint {
    color: var(--muted);
    font-weight: 400;
    font-size: 0.8rem;
  }

  .downstream {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
</style>
