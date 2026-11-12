import {ogCard} from '@davidjfelix/og/card'
import {nitroRuntime} from '@davidjfelix/og/runtime/nitro'
import {defineEventHandler, toWebRequest} from 'h3'
import {cardTheme, site} from '../../../shared/site'

const card = ogCard({
  runtime: nitroRuntime,
  title: site.title,
  description: site.description,
  siteName: site.siteName,
  theme: cardTheme,
})

export default defineEventHandler((event) => card(toWebRequest(event)))
