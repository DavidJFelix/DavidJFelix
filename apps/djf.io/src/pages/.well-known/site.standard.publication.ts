import type {APIRoute} from 'astro'
import {publicationAtUri} from '~/standard-site'

export const GET: APIRoute = () => {
  return new Response(publicationAtUri, {
    headers: {'Content-Type': 'text/plain'},
  })
}
