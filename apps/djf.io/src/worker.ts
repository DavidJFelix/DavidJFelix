import server from '@astrojs/cloudflare/entrypoints/server'
import {negotiateMarkdown} from './lib/markdown-for-agents'

// The worker entry: the @astrojs/cloudflare handler wrapped with Markdown for
// Agents content negotiation (src/lib/markdown-for-agents.ts). The adapter's
// handler still does all the routing -- on-demand routes render, everything
// else falls back to the prerendered assets -- and the wrapper converts the
// resulting HTML to markdown when the request asked for it with
// `Accept: text/markdown`.
//
// Negotiation reads a request header, so it has to run in the worker; that is
// why wrangler.toml sets `run_worker_first` for page paths instead of letting
// the platform serve prerendered assets directly.

type ServerFetchArgs = Parameters<(typeof server)['fetch']>

export default {
  fetch: async (...args: ServerFetchArgs): Promise<Response> => {
    const [request] = args
    return negotiateMarkdown(request, await server.fetch(...args))
  },
}
