<script lang="ts">
import {css} from 'styled-system/css'
import type {Snippet} from 'svelte'
import '../app.css'

const {children}: {children: Snippet} = $props()

const shell = css({maxW: '60rem', mx: 'auto', px: '1.25rem', pb: '4rem'})

const header = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '1rem',
  py: '1.25rem',
  borderBottomWidth: '1px',
  borderColor: 'border',
  mb: '1.5rem',
})

const brand = css({fontWeight: '600', letterSpacing: '0.01em', color: 'text'})
</script>

<svelte:head>
  <title>alchemy state</title>
</svelte:head>

<div class={shell}>
  <header class={header}>
    <a class={brand} href="/">alchemy state</a>
  </header>
  <main>
    {@render children()}
  </main>
</div>
