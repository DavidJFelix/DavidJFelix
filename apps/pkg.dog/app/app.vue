<script setup lang="ts">
import {css} from 'styled-system/css'

const title = 'pkg.dog'
const tag = 'package manager'
const eyebrow = 'A focusing lens for packages'
const heading = 'Only the parts you use.'
const description =
  'pkg.dog tree-shakes published packages into their independent parts and republishes them — so updates and vulnerabilities only reach the code you actually import.'

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

useHead({
  title,
  meta: [{name: 'description', content: description}],
})
</script>

<template>
  <div
    :class="
      css({
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bg: 'white',
        color: 'neutral.900',
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
          borderColor: 'neutral.200',
        })
      "
    >
      <span :class="css({fontWeight: 'semibold', fontSize: 'lg', letterSpacing: 'tight'})">
        {{ title }}
      </span>
      <span :class="css({fontSize: 'sm', color: 'neutral.500'})">{{ tag }}</span>
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
            color: 'neutral.500',
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
            color: 'neutral.600',
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
          :class="css({borderWidth: '1px', borderColor: 'neutral.200', rounded: 'xl', p: '6'})"
        >
          <h2 :class="css({fontSize: 'lg', fontWeight: 'semibold'})">{{ feature.name }}</h2>
          <p :class="css({mt: '2', fontSize: 'sm', color: 'neutral.600', lineHeight: 'relaxed'})">
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
          borderColor: 'neutral.200',
          fontSize: 'sm',
          color: 'neutral.500',
        })
      "
    >
      © 2026 {{ title }}
    </footer>
  </div>
</template>
