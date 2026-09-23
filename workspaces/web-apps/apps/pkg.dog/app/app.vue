<script setup lang="ts">
import {ogSite, ogTags} from '@davidjfelix/og'
import {css} from 'styled-system/css'
import {site} from '../shared/site'

const title = site.title
const tag = 'package manager'
const eyebrow = 'A focusing lens for packages'
const heading = 'Only the parts you use.'
const description = site.description

const features = [
  {
    name: 'Ignore the noise',
    body: "Skip vulnerability and update alerts on paths you don't import.",
  },
  {
    name: 'Upgrade types safely',
    body: 'Move types forward across versions without unrelated churn.',
  },
]

// A preview build bakes in its own pr-<N> URL (NUXT_PUBLIC_SITE_URL, set by
// .depot/actions/preview-wrangler) so its absolute tags name the host that
// serves them; production builds carry the canonical origin.
const {siteUrl} = useRuntimeConfig().public
const social = ogSite({...site, origin: siteUrl || site.origin, path: useRoute().path})

useHead({
  title,
  meta: [{name: 'description', content: description}, ...ogTags(social)],
  link: [{rel: 'canonical', href: String(social.url)}],
})
</script>

<template>
  <div
    :class="
      css({
        minHeight: 'dvh',
        display: 'flex',
        flexDirection: 'column',
        bg: 'bg.canvas',
        color: 'text',
        fontFamily: 'sans',
      })
    "
  >
    <header
      :class="
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: {base: '6', md: '8'},
          py: '5',
          borderBottomWidth: '1px',
          borderColor: 'border',
        })
      "
    >
      <span :class="css({fontWeight: 'semibold', fontSize: 'lg', letterSpacing: 'tight'})">
        {{ title }}
      </span>
      <div :class="css({display: 'flex', alignItems: 'center', gap: '4'})">
        <span :class="css({fontSize: 'sm', color: 'text.muted'})">{{ tag }}</span>
        <ThemeToggle />
      </div>
    </header>

    <main
      :class="
        css({
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: 'full',
          maxWidth: '4xl',
          mx: 'auto',
          px: {base: '6', md: '8'},
          py: {base: '16', md: '24'},
        })
      "
    >
      <p
        :class="
          css({
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'text.muted',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          })
        "
      >
        {{ eyebrow }}
      </p>
      <h1
        :class="
          css({
            mt: '4',
            fontSize: {base: '4xl', md: '6xl'},
            fontWeight: 'bold',
            letterSpacing: 'tight',
            lineHeight: 'tight',
          })
        "
      >
        {{ heading }}
      </h1>
      <p
        :class="
          css({
            mt: '6',
            fontSize: {base: 'lg', md: 'xl'},
            color: 'text.muted',
            maxWidth: '2xl',
            lineHeight: 'relaxed',
          })
        "
      >
        {{ description }}
      </p>

      <ul
        :class="
          css({
            mt: '12',
            display: 'grid',
            gridTemplateColumns: {base: '1fr', sm: 'repeat(2, 1fr)'},
            gap: '6',
            listStyleType: 'none',
            p: '0',
          })
        "
      >
        <li
          v-for="feature in features"
          :key="feature.name"
          :class="css({borderWidth: '1px', borderColor: 'border', rounded: 'xl', p: '6'})"
        >
          <h2 :class="css({fontSize: 'lg', fontWeight: 'semibold'})">{{ feature.name }}</h2>
          <p :class="css({mt: '2', fontSize: 'sm', color: 'text.muted', lineHeight: 'relaxed'})">
            {{ feature.body }}
          </p>
        </li>
      </ul>
    </main>

    <footer
      :class="
        css({
          px: {base: '6', md: '8'},
          py: '6',
          borderTopWidth: '1px',
          borderColor: 'border',
          fontSize: 'sm',
          color: 'text.muted',
        })
      "
    >
      © 2026 {{ title }}
    </footer>
  </div>
</template>
