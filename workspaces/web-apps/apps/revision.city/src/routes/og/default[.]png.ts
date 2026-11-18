import {ogCard} from '@davidjfelix/og/card'
import {viteRuntime} from '@davidjfelix/og/runtime/vite'
import {createFileRoute} from '@tanstack/react-router'
import {readDeployedVersion} from '@/deployed-version'
import {cardTheme, site} from '@/site'

const card = ogCard({
  runtime: viteRuntime,
  version: readDeployedVersion,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

export const Route = createFileRoute('/og/default.png')({
  server: {handlers: {GET: ({request}) => card(request), HEAD: ({request}) => card(request)}},
})
