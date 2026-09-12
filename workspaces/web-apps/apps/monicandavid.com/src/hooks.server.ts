import {error, type Handle, type RequestEvent} from '@sveltejs/kit'
import {env} from '$env/dynamic/private'
import {SESSION_COOKIE, verifySession} from '$lib/server/session'

// Every request under /admin has to carry a valid session cookie; anything
// else on the site is public. The check runs here, before routing, so it
// covers pages, their data requests (client-side navigation fetches
// `__data.json` through this same hook), and any server endpoint added under
// the path later. The verdict lands in `event.locals.session` for the route.
const ADMIN_PATH = /^\/admin(?:\/|$)/u

export const handle: Handle = async ({event, resolve}) => {
  if (ADMIN_PATH.test(event.url.pathname)) {
    event.locals.session = await requireSession(event)
  }
  return resolve(event)
}

async function requireSession(event: RequestEvent): Promise<App.Session> {
  const token = event.cookies.get(SESSION_COOKIE)
  if (token === undefined) {
    error(401, 'Sign in to continue')
  }
  // The secret is a wrangler secret (`wrangler secret put SESSION_SECRET`;
  // `.dev.vars` or `--var` locally). Without it no token can be trusted, and
  // that is a deployment fault worth surfacing as one rather than as 401s.
  const secret = env.SESSION_SECRET
  if (!secret) {
    error(500, 'SESSION_SECRET is not configured')
  }
  const verification = await verifySession({token, secret, now: new Date()})
  if (!verification.ok) {
    error(401, 'Sign in to continue')
  }
  return {userId: verification.userId}
}
