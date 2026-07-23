<script lang="ts">
import {css} from 'styled-system/css'
import {page} from '$app/state'

const section = css({py: '3rem', textAlign: 'center'})
const status = css({fontSize: '2.5rem', m: 0, mb: '0.5rem'})
const message = css({color: 'muted'})
</script>

<svelte:head>
  <title>{page.status} - alchemy state</title>
</svelte:head>

<section class={section}>
  <h1 class={status}>{page.status}</h1>
  <p class={message}>{page.error?.message ?? 'Something went wrong.'}</p>
  <p class={message}><a href="/">Back to stacks</a></p>
</section>
