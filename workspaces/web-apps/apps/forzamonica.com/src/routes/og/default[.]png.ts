import {ogCard} from '@davidjfelix/og/card'
import {viteRuntime} from '@davidjfelix/og/runtime/vite'
import {createFileRoute} from '@tanstack/react-router'
import {cardTheme, site} from '@/site.ts'

const card = ogCard({
  runtime: viteRuntime,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

export const Route = createFileRoute('/og/default.png')({
  server: {handlers: {GET: ({request}) => card(request), HEAD: ({request}) => card(request)}},
})
