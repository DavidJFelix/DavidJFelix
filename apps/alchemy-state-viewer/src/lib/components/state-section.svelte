<script lang="ts">
import {Collapsible} from '@ark-ui/svelte/collapsible'
import {css} from 'styled-system/css'
import JsonView from './json-view.svelte'

const {title, hint, value}: {title: string; hint?: string; value: unknown} = $props()

const root = css({mt: '1.5rem'})

const heading = css({fontSize: '1rem', m: 0, mb: '0.6rem'})

const trigger = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  bg: 'transparent',
  borderWidth: 0,
  p: 0,
})

const indicator = css({
  display: 'inline-block',
  color: 'muted',
  fontSize: '0.7rem',
  transition: 'transform 0.15s',
  '&[data-state="open"]': {
    transform: 'rotate(90deg)',
  },
})

const hintStyle = css({color: 'muted', fontWeight: '400', fontSize: '0.8rem'})
</script>

<Collapsible.Root defaultOpen class={root}>
  <h2 class={heading}>
    <Collapsible.Trigger class={trigger}>
      <Collapsible.Indicator class={indicator}>&#9656;</Collapsible.Indicator>
      {title}
      {#if hint}<span class={hintStyle}>{hint}</span>{/if}
    </Collapsible.Trigger>
  </h2>
  <Collapsible.Content>
    <JsonView {value} />
  </Collapsible.Content>
</Collapsible.Root>
