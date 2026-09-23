<script lang="ts">
import {ogSite, ogTags} from '@davidjfelix/og'
import {css} from 'styled-system/css'
import {page} from '$app/state'
import ThemeToggle from '$lib/components/theme-toggle.svelte'
import {site} from '../site'

const brand = site.title
const description = site.description

// og:url and the canonical link name the page being shared, not the root.
const social = ogSite({...site, path: page.url.pathname})
const socialTags = ogTags(social)
</script>

<svelte:head>
  <title>{brand}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={String(social.url)} />
  {#each socialTags as tag (tag)}
    <meta {...tag} />
  {/each}
</svelte:head>

<div
  class={css({
    minHeight: 'dvh',
    display: 'flex',
    flexDirection: 'column',
    bg: 'bg.canvas',
    color: 'text',
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
      borderColor: 'border',
    })}
  >
    <span class={css({fontWeight: 'semibold', fontSize: 'lg', letterSpacing: 'tight'})}>
      {brand}
    </span>
    <ThemeToggle />
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
        color: 'text.subtle',
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
        color: 'text.muted',
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
      borderColor: 'border',
      fontSize: 'sm',
      color: 'text.subtle',
    })}
  >
    © 2026 {brand}
  </footer>
</div>
