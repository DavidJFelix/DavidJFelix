import {fileURLToPath} from 'node:url'
import {unified} from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import {defineConfig} from 'astro/config'
import * as pagefind from 'pagefind'

// Indexes the built site so /pagefind/pagefind.js is served alongside it for
// the Search island. Runs only on `astro build`; dev mode has no index.
function pagefindIntegration() {
  return {
    name: 'pagefind',
    hooks: {
      'astro:build:done': async ({dir, logger}) => {
        const outDir = fileURLToPath(dir)
        const {index, errors: createErrors} = await pagefind.createIndex()
        if (!index) {
          throw new Error(`pagefind could not create an index: ${createErrors.join(', ')}`)
        }
        const {errors: addErrors, page_count: pageCount} = await index.addDirectory({path: outDir})
        if (addErrors.length > 0) {
          throw new Error(`pagefind could not index ${outDir}: ${addErrors.join(', ')}`)
        }
        const {errors: writeErrors} = await index.writeFiles({outputPath: `${outDir}/pagefind`})
        if (writeErrors.length > 0) {
          throw new Error(`pagefind could not write the index: ${writeErrors.join(', ')}`)
        }
        await pagefind.close()
        logger.info(`indexed ${pageCount} pages`)
      },
    },
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://djf.io',
  redirects: {
    '/blog/2024-4-26-on-positivity': '/blog/2024-04-26-on-positivity',
  },
  markdown: {
    processor: unified(),
  },
  integrations: [react(), mdx(), sitemap(), pagefindIntegration()],
})
