<script lang="ts">
import {JsonTreeView} from '@ark-ui/svelte/json-tree-view'
import {css} from 'styled-system/css'

const {value}: {value: unknown} = $props()

const container = css({
  px: '1rem',
  py: '0.9rem',
  bg: 'surface',
  borderWidth: '1px',
  borderColor: 'border',
  borderRadius: '8px',
  overflowX: 'auto',
  fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSize: '0.85rem',
  lineHeight: '1.6',
  '& [data-part="branch-content"]': {
    ps: '1.25rem',
  },
  '& [data-part="branch-control"]': {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    cursor: 'pointer',
  },
  '& [data-part="branch-indicator"]': {
    display: 'inline-block',
    color: 'muted',
    fontSize: '0.7rem',
    transition: 'transform 0.15s',
    '&[data-state="open"]': {
      transform: 'rotate(90deg)',
    },
  },
  '& [data-kind="key"]': {
    color: 'accent',
  },
  '& [data-kind="colon"]': {
    color: 'muted',
    me: '0.35rem',
  },
  '& [data-kind="brace"], & [data-kind="bracket"], & [data-kind="preview-text"]': {
    color: 'muted',
  },
  '& [data-type="string"]': {
    color: 'ok',
  },
  '& [data-type="number"]': {
    color: 'busy',
  },
  '& [data-type="boolean"], & [data-type="null"], & [data-type="undefined"]': {
    color: 'warn',
  },
})
</script>

<div class={container}>
  <JsonTreeView.Root data={value} defaultExpandedDepth={3}>
    <JsonTreeView.Tree>
      {#snippet arrow()}<span>&#9656;</span>{/snippet}
    </JsonTreeView.Tree>
  </JsonTreeView.Root>
</div>
