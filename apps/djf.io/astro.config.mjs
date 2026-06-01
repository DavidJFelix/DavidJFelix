import {unified} from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import {defineConfig} from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://djf.io',
  markdown: {
    processor: unified(),
  },
  integrations: [react(), mdx()],
})
