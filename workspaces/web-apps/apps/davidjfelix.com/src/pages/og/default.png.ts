import {ogCard} from '@davidjfelix/og/card'
import {viteRuntime} from '@davidjfelix/og/runtime/vite'
import type {APIRoute} from 'astro'
import {cardTheme, site} from '../../site'

// This route runs on demand, unlike the pages: astro.config.mjs prerenders in
// Node, and viteRuntime loads only in the Worker.
export const prerender = false

const card = ogCard({
  runtime: viteRuntime,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

export const GET: APIRoute = ({request}) => card(request)
