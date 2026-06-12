<script lang="ts">
import {css} from 'styled-system/css'

const title = 'monicandavid.com'
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={title} />
</svelte:head>

<main
  class={css({
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'sans',
    bg: 'white',
    color: 'neutral.900',
  })}
>
  <h1 class={css({fontSize: '5xl', fontWeight: 'bold', letterSpacing: 'tight'})}>{title}</h1>
</main>
