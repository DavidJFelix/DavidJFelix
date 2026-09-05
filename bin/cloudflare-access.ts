// Cloudflare Access support for the preview probes. A worker whose workers.dev
// hostname sits behind Access (onvibes.org) answers every unauthenticated
// request with a 302 to the account's Access login page -- a 200 HTML document
// once followed, which would wave the smoke checks through and leave
// Playwright staring at a login form. Two pieces keep the probes honest:
//
// - accessHeaders: the service-token headers Access accepts in place of a
//   browser login, read from CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
//   (repo secrets, plumbed through .depot/actions/preview-wrangler). Empty when
//   unset, so hosts without Access see no difference.
// - isAccessLogin: recognizes a response that ended up on the Access login
//   page after redirects, so a probe reports the real cause instead of a
//   vacuous 200.

// cSpell:words cloudflareaccess -- the hostname every Access login page lives under
const ACCESS_LOGIN_HOST_SUFFIX = '.cloudflareaccess.com'

export interface AccessEnv {
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
}

export function accessHeaders(env: AccessEnv): Record<string, string> {
  const id = env.CF_ACCESS_CLIENT_ID
  const secret = env.CF_ACCESS_CLIENT_SECRET
  if (!id || !secret) return {}
  return {'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret}
}

export function isAccessLogin(response: Pick<Response, 'url'>): boolean {
  if (response.url === '') return false
  return new URL(response.url).hostname.endsWith(ACCESS_LOGIN_HOST_SUFFIX)
}

export const ACCESS_LOGIN_DETAIL =
  'redirected to the Cloudflare Access login page (the host is behind Access; ' +
  'set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET to a service token it accepts)'
