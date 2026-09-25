import {isNullish} from './nullish'

// Entries are keyed on the site's own origin, which is the zone the Workers
// cache belongs to in production; the paths never resolve to a page.
export const GITHUB_CACHE_KEY_ROOT = 'https://revision.city/.cache/github/'
const CREDENTIALS_REJECTED_KEY = `${GITHUB_CACHE_KEY_ROOT}credentials-rejected`
const RATE_LIMITED_KEY = `${GITHUB_CACHE_KEY_ROOT}rate-limited`
const RESERVED_KEY = `${GITHUB_CACHE_KEY_ROOT}budget-reserved`
// How long the app's credentials stay withheld after GitHub rejects them, so a
// rejection costs one extra call an hour per edge rather than one per lookup;
// a rotated secret takes effect within the hour.
const CREDENTIALS_REJECTED_MAX_AGE_SECONDS = 60 * 60
// How long callers stay off GitHub after it answers that the rate limit is
// spent: until the reset it names, a minute when it names none, an hour at
// most. A crawler walking pull request numbers, or an outage sending every
// anonymous diff load to the fallback, can spend the budget; once it is gone,
// asking again would only cost each page the wait for an answer GitHub will
// not give.
const RATE_LIMITED_DEFAULT_SECONDS = 60
const RATE_LIMITED_MAX_AGE_SECONDS = 60 * 60
// What the hour's budget keeps for the share cards. A card costs one call per
// pull request per edge per hour, while a signed-out diff's fallback costs up
// to two per load and runs for every anonymous load while github.com is
// turning the Worker away, so it stands down under this rather than spend the
// cards' share.
const RESERVE_REQUESTS = 1_000

// The Workers Cache API's shape, so the default cache and a test double both fit.
export interface ResponseCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

// Why the app's credentials are not worth offering right now, as the edge
// remembers GitHub's last verdict on them. Two consumers spend them on public
// data, the share-card lookup and a signed-out diff's fallback, and one budget
// answers for both, so they back off together.
export type AppBudgetHold = 'rate-limited' | 'credentials-rejected' | 'reserved'

export interface AppBudgetOptions {
  cache?: ResponseCache
}

// The hold in force, if any. A spent limit outranks rejected credentials,
// which outrank the reserve: each says more than the next about what an
// attempt could still achieve.
export async function readAppBudgetHold({
  cache,
}: AppBudgetOptions): Promise<AppBudgetHold | undefined> {
  if (await readMarker(cache, RATE_LIMITED_KEY)) {
    return 'rate-limited'
  }
  if (await readMarker(cache, CREDENTIALS_REJECTED_KEY)) {
    return 'credentials-rejected'
  }
  if (await readMarker(cache, RESERVED_KEY)) {
    return 'reserved'
  }
  return undefined
}

export interface NoteAppBudgetAnswerParams extends AppBudgetOptions {
  response: Response
  // Whether the request carried the app's credentials. Only then is a 401
  // their rejection, and the remaining count the app's rather than an
  // address's.
  offered: boolean
}

// Remembers what GitHub's answer says about the budget, for every later caller
// at this edge, and reports it: rejected credentials, a spent limit, or a
// remaining count under the reserve. Nothing for an answer that says none of
// those.
export async function noteAppBudgetAnswer({
  cache,
  response,
  offered,
}: NoteAppBudgetAnswerParams): Promise<AppBudgetHold | undefined> {
  if (offered && response.status === 401) {
    await writeMarker(cache, CREDENTIALS_REJECTED_KEY, CREDENTIALS_REJECTED_MAX_AGE_SECONDS)
    return 'credentials-rejected'
  }
  const rateLimitedFor = readRateLimitedFor(response)
  if (!isNullish(rateLimitedFor)) {
    await writeMarker(cache, RATE_LIMITED_KEY, rateLimitedFor)
    return 'rate-limited'
  }
  if (offered && isUnderReserve(response)) {
    await writeMarker(cache, RESERVED_KEY, readSecondsUntilReset(response))
    return 'reserved'
  }
  return undefined
}

// How long GitHub asks callers to stay away when an answer says the rate limit
// is spent: a 403 or 429 naming a retry-after (the secondary limit), or a 403
// whose remaining count is zero (the primary limit), which names its reset as
// a unix time. Undefined for a 403 refused for another reason.
function readRateLimitedFor(response: Response): number | undefined {
  if (response.status !== 403 && response.status !== 429) {
    return undefined
  }
  const retryAfter = Number(response.headers.get('retry-after'))
  if (retryAfter > 0) {
    return clampWait(retryAfter)
  }
  const spent = response.headers.get('x-ratelimit-remaining') === '0'
  if (response.status === 403 && !spent) {
    return undefined
  }
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  const untilReset = spent && reset > 0 ? reset - Date.now() / 1000 : 0
  return clampWait(untilReset > 0 ? untilReset : RATE_LIMITED_DEFAULT_SECONDS)
}

function isUnderReserve(response: Response): boolean {
  const remaining = response.headers.get('x-ratelimit-remaining')
  if (isNullish(remaining)) {
    return false
  }
  const count = Number(remaining)
  return Number.isFinite(count) && count < RESERVE_REQUESTS
}

// Until the reset the answer names; a minute when it names none, or one that
// already passed; an hour at most.
function readSecondsUntilReset(response: Response): number {
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  const untilReset = reset > 0 ? reset - Date.now() / 1000 : 0
  return clampWait(untilReset > 0 ? untilReset : RATE_LIMITED_DEFAULT_SECONDS)
}

function clampWait(seconds: number): number {
  return Math.min(Math.ceil(seconds), RATE_LIMITED_MAX_AGE_SECONDS)
}

// A marker is a fact the edge remembers for a while -- the credentials were
// rejected, the rate limit is spent -- whose presence is the whole message.
// The cache is a nicety, never a dependency: a cache that throws (an origin
// the edge will not key on, a runtime without one) reads as empty.
async function readMarker(cache: ResponseCache | undefined, key: string): Promise<boolean> {
  try {
    return !isNullish(await cache?.match(new Request(key)))
  } catch {
    return false
  }
}

async function writeMarker(
  cache: ResponseCache | undefined,
  key: string,
  maxAgeSeconds: number,
): Promise<void> {
  try {
    await cache?.put(
      new Request(key),
      Response.json(
        {marked: true},
        {headers: {'Cache-Control': `public, max-age=${maxAgeSeconds}`}},
      ),
    )
  } catch {
    // Nothing to do: the next caller asks GitHub again.
  }
}

// `caches.default` is Cloudflare's addition to CacheStorage, absent from the
// standard type and from Node, so it is looked up rather than declared.
export function defaultResponseCache(): ResponseCache | undefined {
  const caches: unknown = Reflect.get(globalThis, 'caches')
  const store = isRecord(caches) ? caches.default : undefined
  return isResponseCache(store) ? store : undefined
}

function isResponseCache(value: unknown): value is ResponseCache {
  return isRecord(value) && typeof value.match === 'function' && typeof value.put === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
