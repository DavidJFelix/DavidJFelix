import type {PageServerLoad} from './$types'

// Deliberately minimal: the hook (src/hooks.server.ts) has already refused any
// request that reaches here without a valid session. Having a server load at
// all is what makes client-side navigation to /admin go through the server --
// a page with no server data would render straight from the client bundle,
// bypassing the hook -- and it hands the page the id the session vouches for.
export const load: PageServerLoad = ({locals}) => ({userId: locals.session?.userId})
