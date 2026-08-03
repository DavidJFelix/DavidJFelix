import type {APIRoute} from 'astro'
import {publicationUri} from '../../lib/standard-site'

// standard.site domain-verification artifact: returns this site's publication
// AT-URI as plain text so ATProto clients can tie djf.io to its
// site.standard.publication record. No specific content-type is required.
export const GET: APIRoute = () =>
  new Response(publicationUri(), {headers: {'content-type': 'text/plain; charset=utf-8'}})
