<script lang="ts">
import {css} from 'styled-system/css'

const brand = 'Monica & David'
const description = 'A little blog about our life together. Posts coming soon.'
</script>

<svelte:head>
  <title>{brand}</title>
  <meta name="description" content={description} />
</svelte:head>

<div
  class={css({
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    bg: 'white',
    color: 'neutral.900',
    fontFamily: 'sans',
  })}
>
  <header
    class={css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: {base: '6', md: '8'},
      py: '5',
      borderBottomWidth: '1px',
      borderColor: 'neutral.200',
    })}
  >
    <span class={css({fontWeight: 'semibold', fontSize: 'lg', letterSpacing: 'tight'})}>
      {brand}
    </span>
  </header>

  <main
    class={css({
      flex: '1',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      width: 'full',
      maxWidth: '4xl',
      mx: 'auto',
      px: {base: '6', md: '8'},
      py: {base: '16', md: '24'},
    })}
  >
    <p
      class={css({
        fontSize: 'sm',
        fontWeight: 'medium',
        color: 'neutral.500',
        textTransform: 'uppercase',
        letterSpacing: 'wider',
      })}
    >
      Our blog
    </p>
    <h1
      class={css({
        mt: '4',
        fontSize: {base: '4xl', md: '6xl'},
        fontWeight: 'bold',
        letterSpacing: 'tight',
        lineHeight: 'tight',
      })}
    >
      {brand}
    </h1>
    <p
      class={css({
        mt: '6',
        fontSize: {base: 'lg', md: 'xl'},
        color: 'neutral.600',
        maxWidth: '2xl',
        lineHeight: 'relaxed',
      })}
    >
      {description}
    </p>
  </main>

  <footer
    class={css({
      px: {base: '6', md: '8'},
      py: '6',
      borderTopWidth: '1px',
      borderColor: 'neutral.200',
      fontSize: 'sm',
      color: 'neutral.500',
    })}
  >
    © 2026 {brand}
  </footer>
</div>
