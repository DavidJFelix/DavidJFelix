import {ogCard} from '@davidjfelix/og/card'
import {cardTheme, site} from '../../../site'
import type {RequestHandler} from './$types'

// The route loads the runtime on the first request, not at import: SvelteKit's
// build imports every route module in Node, where viteRuntime does not load.
let card: Promise<(request: Request) => Promise<Response>> | undefined

const loadCard = () =>
  (card ??= import('@davidjfelix/og/runtime/vite').then(({viteRuntime}) =>
    ogCard({
      runtime: viteRuntime,
      title: site.title,
      description: site.description,
      siteName: site.siteName,
      theme: cardTheme,
    }),
  ))

export const GET: RequestHandler = async ({request}) => (await loadCard())(request)
