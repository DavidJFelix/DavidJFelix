import type {GitHubAccessRemedy} from './github-access-remedy'
import {
  type AppBudgetHold,
  defaultResponseCache,
  noteAppBudgetAnswer,
  type ResponseCache,
  readAppBudgetHold,
} from './github-app-budget'
import {
  type GitHubAppCredentials,
  type GitHubAuthSession,
  readGitHubAppCredentials,
  resolveGitHubAuth,
  withSetCookieHeaders,
} from './github-auth'
import {
  encodeURLSegment,
  type GitHubDiffSource,
  type GitHubRepo,
  parseGitHubDiffSource,
} from './github-diff-source'
import {diagnoseGitHubAccess} from './github-repo-access'
import {isNullish} from './nullish'

const CACHE_CONTROL = 'no-store'
const EMPTY_PATCH_MESSAGE = 'GitHub returned an empty diff.'
const GITHUB_API_ROOT = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const GITHUB_DIFF_MEDIA_TYPE = 'application/vnd.github.diff'
const GITHUB_JSON_MEDIA_TYPE = 'application/vnd.github+json'
const GITHUB_HOST = 'github.com'
const GITHUB_RAW_DIFF_HOST = 'patch-diff.githubusercontent.com'
const NON_DIFF_RESPONSE_MESSAGE = 'GitHub did not return a diff for this URL.'
const NON_WHITESPACE_PATTERN = /\S/
const RAW_GITHUB_DIFF_PATH_PATTERN = /^\/raw\/[^/]+\/[^/]+\/pull\/[^/]+\.(?:diff|patch)$/
const GITHUB_PULL_TAB_PATH_PATTERN = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(?:changes|files)$/
const UPSTREAM_FAILURE_LOG_MESSAGE = 'diff upstream attempt failed'
const APP_FALLBACK_WITHHELD_LOG_MESSAGE = 'diff app fallback withheld'

const HIDDEN_PATCH_DOMAIN_RULES = [{domainRoot: 'tangled.org', defaultExtension: '.patch'}] as const

type DiffFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>

export interface DiffRequestOptions {
  // The app's own client id and secret. A signed-out visitor's diff falls back
  // to GitHub's API with these as basic auth, which GitHub answers with public
  // data only, at the app's rate limit instead of the anonymous per-address one
  // the Worker shares with every other Worker. Read from the worker env when
  // not given.
  credentials?: GitHubAppCredentials
  fetch?: DiffFetch
  // Where the edge remembers GitHub's verdicts on those credentials, shared
  // with the share-card lookup so both back off together. The Workers cache
  // when not given.
  cache?: ResponseCache
}

// How a GitHub API attempt identifies itself: as the signed-in visitor, whose
// token also reaches private repositories, or as the app itself, which GitHub
// honors for public data only.
type GitHubAPIAuth =
  | {kind: 'visitor'; token: string}
  | {kind: 'app'; credentials: GitHubAppCredentials}

type GitHubAPIAuthKind = GitHubAPIAuth['kind']

interface DirectPatchFetchTarget {
  kind?: 'direct'
  // Whose credentials the attempt carries, if any. An app-authenticated
  // attempt spends the shared budget, so it waits on the budget's holds.
  auth?: GitHubAPIAuthKind
  label?: string
  patchURL: string
  requestHeaders?: Record<string, string>
  // Set on a fallback that can see no more than the attempt before it could:
  // after a 404 it is skipped, since the diff is missing or private either way.
  skipAfterNotFound?: boolean
  sourceURL?: string
}

interface GitHubPullPatchFetchTarget {
  kind: 'github-pull'
  auth: GitHubAPIAuthKind
  authorization: string
  compareLabel: string
  label?: string
  pullURL: string
  repo: GitHubRepo
  requestHeaders: Record<string, string>
  skipAfterNotFound?: boolean
  sourceURL: string
}

type PatchFetchTarget = DirectPatchFetchTarget | GitHubPullPatchFetchTarget

interface ResolvedPatchRequest extends DirectPatchFetchTarget {
  fallbacks?: PatchFetchTarget[]
}

interface PatchFetchResult {
  response: Response
  target: DirectPatchFetchTarget
}

// The signed-in viewer, carried down the fetch chain so a failure can be
// diagnosed against the same identity that made the attempt.
interface DiffViewerAuth {
  login?: string
  token?: string
}

interface PatchFailure {
  message: string
  remedy?: GitHubAccessRemedy
  status: number
}

// Validates the accepted path or URL, normalizes it to a raw diff URL, and
// returns a streaming proxy response so the client can render files as they
// arrive instead of waiting for the full patch text. GitHub auth comes from
// the signed-in session cookie, never from the client request itself.
export async function handleDiffRequest(
  request: Request,
  options: DiffRequestOptions = {},
): Promise<Response> {
  const auth = await resolveGitHubAuth(request, options)
  const response = await createDiffResponse({
    request,
    session: auth.session,
    credentials: options.credentials ?? readGitHubAppCredentials(),
    fetcher: options.fetch ?? fetch,
    cache: options.cache ?? defaultResponseCache(),
  })
  return withSetCookieHeaders(response, auth.setCookieHeaders)
}

interface CreateDiffResponseParams {
  request: Request
  session: GitHubAuthSession | undefined
  credentials: GitHubAppCredentials | undefined
  fetcher: DiffFetch
  cache: ResponseCache | undefined
}

async function createDiffResponse({
  request,
  session,
  credentials,
  fetcher,
  cache,
}: CreateDiffResponseParams): Promise<Response> {
  const searchParams = new URL(request.url).searchParams
  const path = searchParams.get('path')
  const domain = searchParams.get('domain')
  const url = searchParams.get('url')
  const token = session?.accessToken
  const apiAuth = resolveGitHubAPIAuth({token, credentials})

  if (isNullish(path) && isNullish(url)) {
    return createErrorResponse({message: 'Path or URL parameter is required', status: 400})
  }

  try {
    // The client normally sends only the GitHub-relative path, but GitHub also
    // exposes raw PR diffs through patch-diff.githubusercontent.com. Tangled
    // paths use an explicit domain query parameter and are normalized to their
    // patch endpoint.
    const patchRequest = resolvePatchRequest({path, domain, url, apiAuth})
    if (isNullish(patchRequest)) {
      return createErrorResponse({message: 'Invalid GitHub patch URL format', status: 400})
    }

    return await createPatchStreamResponse({
      patchRequest,
      requestSignal: request.signal,
      viewer: {login: session?.login, token},
      fetcher,
      cache,
    })
  } catch (error) {
    return createErrorResponse({
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    })
  }
}

interface ResolveGitHubAPIAuthParams {
  token: string | undefined
  credentials: GitHubAppCredentials | undefined
}

// A signed-in visitor's token sees everything their account can; everyone else
// borrows the app's own credentials, when configured, so a public diff has a
// second route off the anonymous lane.
function resolveGitHubAPIAuth({
  token,
  credentials,
}: ResolveGitHubAPIAuthParams): GitHubAPIAuth | undefined {
  if (!isNullish(token)) {
    return {kind: 'visitor', token}
  }
  if (!isNullish(credentials)) {
    return {kind: 'app', credentials}
  }
  return undefined
}

interface ResolvePatchRequestParams {
  path: string | null
  domain: string | null
  url: string | null
  apiAuth: GitHubAPIAuth | undefined
}

// Resolves the accepted URL shapes to the exact upstream URL to fetch. Most
// callers send a GitHub-relative path, but this also permits GitHub's raw PR
// diff host and Tangled patch URLs without becoming a general URL fetcher.
function resolvePatchRequest({
  path,
  domain,
  url,
  apiAuth,
}: ResolvePatchRequestParams): ResolvedPatchRequest | undefined {
  if (!isNullish(url)) {
    return resolvePatchURLInput(url, apiAuth)
  }

  if (isNullish(path)) {
    return undefined
  }

  if (!isNullish(domain)) {
    const patchURL = resolveDomainPatchURL(domain, path)
    return isNullish(patchURL) ? undefined : {patchURL}
  }

  return resolvePatchURLInput(path, apiAuth)
}

function resolvePatchURLInput(
  input: string,
  apiAuth: GitHubAPIAuth | undefined,
): ResolvedPatchRequest | undefined {
  if (input.startsWith('/')) {
    return resolveGitHubPatchRequest(input, apiAuth)
  }

  let parsedURL: URL
  try {
    parsedURL = new URL(input)
  } catch {
    return undefined
  }

  if (!isAllowedHttpsUrl(parsedURL)) {
    return undefined
  }

  if (parsedURL.hostname === GITHUB_HOST) {
    return resolveGitHubPatchRequest(parsedURL.pathname, apiAuth)
  }

  if (
    parsedURL.hostname === GITHUB_RAW_DIFF_HOST &&
    RAW_GITHUB_DIFF_PATH_PATTERN.test(parsedURL.pathname)
  ) {
    const gitHubPath = parsedURL.pathname.slice('/raw'.length)
    const publicRequest: ResolvedPatchRequest = {
      label: 'public patch-diff URL',
      patchURL: parsedURL.href,
      sourceURL: createGitHubSourceURL(gitHubPath),
    }
    return isNullish(apiAuth)
      ? publicRequest
      : {...publicRequest, fallbacks: resolveGitHubFallbacks(gitHubPath, apiAuth)}
  }

  const domainPatchURL = resolveDomainPatchURL(parsedURL.hostname, parsedURL.pathname)
  return isNullish(domainPatchURL) ? undefined : {patchURL: domainPatchURL}
}

function resolveGitHubPatchRequest(
  path: string,
  apiAuth: GitHubAPIAuth | undefined,
): ResolvedPatchRequest | undefined {
  const patchURL = resolveGitHubPath(path)
  if (isNullish(patchURL)) {
    return undefined
  }

  const publicRequest: ResolvedPatchRequest = {
    label: 'public github.com diff URL',
    patchURL,
    // Carried even on the unauthenticated attempt so a failure can still be
    // traced back to a repository, which is what makes "sign in and grant
    // access" answerable for signed-out visitors.
    sourceURL: createGitHubSourceURL(path),
  }
  return isNullish(apiAuth)
    ? publicRequest
    : {...publicRequest, fallbacks: resolveGitHubFallbacks(path, apiAuth)}
}

// What to try once the public route fails. A visitor's token also works on
// github.com itself, so their chain retries the same route signed in before
// turning to the API. The app's credentials work on the API alone, and see only
// public data, so their one attempt is not worth spending after a 404.
function resolveGitHubFallbacks(path: string, apiAuth: GitHubAPIAuth): PatchFetchTarget[] {
  const webRequest =
    apiAuth.kind === 'visitor'
      ? resolveAuthenticatedGitHubWebPatchRequest(path, apiAuth.token)
      : undefined
  return [webRequest, resolveGitHubAPIPatchRequest(path, apiAuth)].filter(isPatchFetchTarget)
}

function resolveAuthenticatedGitHubWebPatchRequest(
  path: string,
  token: string,
): DirectPatchFetchTarget | undefined {
  const patchURL = resolveGitHubPath(path)
  if (isNullish(patchURL)) {
    return undefined
  }
  return {
    auth: 'visitor',
    label: 'authenticated github.com diff URL',
    patchURL,
    requestHeaders: createGitHubAuthHeaders(token),
  }
}

function resolveGitHubAPIPatchRequest(
  path: string,
  apiAuth: GitHubAPIAuth,
): PatchFetchTarget | undefined {
  const normalizedPath = normalizeGitHubPath(path)
  const source = parseGitHubDiffSource(normalizedPath)
  if (isNullish(source)) {
    return undefined
  }

  const sourceURL = createGitHubSourceURL(path)
  const authorization = createAuthorizationHeader(apiAuth)
  const labelPrefix = apiAuth.kind === 'visitor' ? 'authenticated' : 'app-authenticated'
  const skipAfterNotFound = apiAuth.kind === 'app'
  if (source.kind === 'pull') {
    return {
      kind: 'github-pull',
      auth: apiAuth.kind,
      authorization,
      compareLabel: `${labelPrefix} pull compare diff API`,
      label: `${labelPrefix} pull metadata`,
      pullURL: createGitHubDiffApiUrl(source),
      repo: source.repo,
      requestHeaders: createGitHubJSONAPIHeaders(authorization),
      skipAfterNotFound,
      sourceURL,
    }
  }

  return {
    auth: apiAuth.kind,
    label: `${labelPrefix} ${source.kind} diff API`,
    patchURL: createGitHubDiffApiUrl(source),
    requestHeaders: createGitHubDiffAPIHeaders(authorization),
    skipAfterNotFound,
    sourceURL,
  }
}

function isPatchFetchTarget(target: PatchFetchTarget | undefined): target is PatchFetchTarget {
  return !isNullish(target)
}

function resolveDomainPatchURL(domain: string, path: string): string | undefined {
  const domainRule = getHiddenPatchDomainRule(domain)
  if (isNullish(domainRule)) {
    return undefined
  }

  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`https://${domainRule.hostname}`)
  const normalizedPath = pathWithLeadingSlash.replace(/\/+$/, '')
  url.pathname = normalizedPath === '' ? '/' : normalizedPath
  if (!url.pathname.endsWith(domainRule.defaultExtension)) {
    url.pathname += domainRule.defaultExtension
  }

  return url.href
}

function getHiddenPatchDomainRule(
  domain: string,
): {defaultExtension: string; hostname: string} | undefined {
  let hostname: string
  try {
    hostname = new URL(`https://${domain}`).hostname
  } catch {
    return undefined
  }

  for (const domainRule of HIDDEN_PATCH_DOMAIN_RULES) {
    if (hostname === domainRule.domainRoot || hostname.endsWith(`.${domainRule.domainRoot}`)) {
      return {defaultExtension: domainRule.defaultExtension, hostname}
    }
  }

  return undefined
}

function resolveGitHubPath(path: string): string | undefined {
  if (path === '/') {
    return undefined
  }

  let patchPath = normalizeGitHubPath(path)
  if (patchPath === '') {
    return undefined
  }

  if (!patchPath.endsWith('.patch') && !patchPath.endsWith('.diff')) {
    patchPath += '.diff'
  }

  return `https://${GITHUB_HOST}${patchPath}`
}

// The human-facing github.com URL a patch attempt stands for, which is what the
// access diagnosis parses back into an owner, repository, and diff source.
function createGitHubSourceURL(path: string): string {
  return `https://${GITHUB_HOST}${removeDiffExtension(normalizeGitHubPath(path))}`
}

function removeDiffExtension(path: string): string {
  if (path.endsWith('.patch')) {
    return path.slice(0, -'.patch'.length)
  }

  if (path.endsWith('.diff')) {
    return path.slice(0, -'.diff'.length)
  }

  return path
}

function normalizeGitHubPath(path: string): string {
  const trimmedPath = path.replace(/\/+$/, '')
  const pullTabMatch = GITHUB_PULL_TAB_PATH_PATTERN.exec(trimmedPath)
  if (isNullish(pullTabMatch)) {
    return trimmedPath
  }

  return `/${pullTabMatch[1]}/${pullTabMatch[2]}/pull/${pullTabMatch[3]}`
}

function isAllowedHttpsUrl(url: URL): boolean {
  return url.protocol === 'https:' && url.port === '' && url.username === '' && url.password === ''
}

function createGitHubDiffApiUrl(source: GitHubDiffSource): string {
  switch (source.kind) {
    case 'pull':
      return createGitHubApiUrl(
        `/repos/${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}/pulls/${encodeURLSegment(source.number)}`,
      )
    case 'commit':
      return createGitHubApiUrl(
        `/repos/${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}/commits/${encodeURLSegment(source.sha)}`,
      )
    case 'compare':
      return createGitHubApiUrl(
        `/repos/${encodeURLSegment(source.repo.owner)}/${encodeURLSegment(source.repo.repo)}/compare/${encodeURLSegment(source.range)}`,
      )
  }
}

function createAuthorizationHeader(apiAuth: GitHubAPIAuth): string {
  return apiAuth.kind === 'visitor'
    ? `Bearer ${apiAuth.token}`
    : `Basic ${btoa(`${apiAuth.credentials.clientId}:${apiAuth.credentials.clientSecret}`)}`
}

function createGitHubAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  }
}

function createGitHubApiUrl(path: string): string {
  return new URL(path, GITHUB_API_ROOT).href
}

function createGitHubDiffAPIHeaders(authorization: string): Record<string, string> {
  return {
    Accept: GITHUB_DIFF_MEDIA_TYPE,
    Authorization: authorization,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

function createGitHubJSONAPIHeaders(authorization: string): Record<string, string> {
  return {
    Accept: GITHUB_JSON_MEDIA_TYPE,
    Authorization: authorization,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

interface TextResponseOptions {
  status?: number
  sourceURL?: string
}

// Serves local patch fixtures through the same response path as GitHub data,
// while rejecting empty files so the viewer does not enter a silent no-op
// state.
function createPatchTextResponse(
  patchText: string,
  options: Omit<TextResponseOptions, 'status'>,
): Response {
  if (!NON_WHITESPACE_PATTERN.test(patchText)) {
    return createErrorResponse({message: EMPTY_PATCH_MESSAGE, status: 422})
  }

  return createTextResponse(patchText, options)
}

interface CreatePatchStreamResponseParams {
  patchRequest: ResolvedPatchRequest
  requestSignal: AbortSignal
  viewer: DiffViewerAuth
  fetcher: DiffFetch
  cache: ResponseCache | undefined
}

// Validates the upstream response before opening the client-facing stream so
// GitHub HTML pages and redirects become small text errors instead of framework
// error documents. Each failed attempt is logged and the next fallback tried;
// only the last one is explained to the visitor. An app-authenticated attempt
// spends the shared budget, so it waits on the budget's holds and reports its
// answer back for the next caller.
async function createPatchStreamResponse({
  patchRequest,
  requestSignal,
  viewer,
  fetcher,
  cache,
}: CreatePatchStreamResponseParams): Promise<Response> {
  const upstreamController = new AbortController()
  const abortUpstream = () => {
    upstreamController.abort()
  }
  requestSignal.addEventListener('abort', abortUpstream, {once: true})
  // Read once per request, and only once an app-authenticated fallback is due.
  let budgetHold: Promise<AppBudgetHold | undefined> | undefined
  const readBudgetHold = () => {
    budgetHold ??= readAppBudgetHold({cache})
    return budgetHold
  }

  let activeRequest: PatchFetchTarget = patchRequest
  const fallbackRequests = [...(patchRequest.fallbacks ?? [])]
  let response: Response | undefined
  let responseTarget: DirectPatchFetchTarget | undefined
  for (;;) {
    try {
      const fetchResult = await fetchPatchTarget({
        target: activeRequest,
        signal: upstreamController.signal,
        fetcher,
      })
      response = fetchResult.response
      responseTarget = fetchResult.target
    } catch (error) {
      // A visitor leaving mid-fetch aborts the upstream too; that is not GitHub's failure.
      if (!requestSignal.aborted) {
        logUpstreamFailure({target: activeRequest, viewer, error})
      }
      const fallbackRequest = await takeNextFallback({queue: fallbackRequests, readBudgetHold})
      if (!isNullish(fallbackRequest)) {
        activeRequest = fallbackRequest
        continue
      }

      requestSignal.removeEventListener('abort', abortUpstream)
      return createErrorResponse({message: 'Failed to fetch patch.', status: 502})
    }

    if (responseTarget.auth === 'app') {
      await noteAppBudgetAnswer({cache, response, offered: true})
    }

    const failure = readPatchResponseFailure(response, responseTarget)
    if (isNullish(failure)) {
      break
    }

    logUpstreamFailure({target: responseTarget, viewer, response})
    const fallbackRequest = await takeNextFallback({
      queue: fallbackRequests,
      upstreamStatus: response.status,
      readBudgetHold,
    })
    if (!isNullish(fallbackRequest)) {
      await response.body?.cancel().catch(() => {})
      activeRequest = fallbackRequest
      continue
    }

    requestSignal.removeEventListener('abort', abortUpstream)
    return createErrorResponse({
      ...(await explainPatchFailure({failure, response, target: responseTarget, viewer, fetcher})),
      sourceURL: responseTarget.sourceURL ?? responseTarget.patchURL,
    })
  }

  if (isNullish(response) || isNullish(responseTarget)) {
    requestSignal.removeEventListener('abort', abortUpstream)
    return createErrorResponse({message: 'Failed to fetch patch.', status: 502})
  }

  const options = {
    sourceURL: responseTarget.sourceURL ?? responseTarget.patchURL,
  } satisfies Omit<TextResponseOptions, 'status'>

  const responseBody = response.body
  if (isNullish(responseBody)) {
    try {
      const patchText = await response.text()
      return createPatchTextResponse(patchText, options)
    } finally {
      requestSignal.removeEventListener('abort', abortUpstream)
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void pumpPatchBody(responseBody, controller).finally(() => {
        requestSignal.removeEventListener('abort', abortUpstream)
      })
    },
    cancel() {
      abortUpstream()
      requestSignal.removeEventListener('abort', abortUpstream)
    },
  })

  return createTextResponse(stream, options)
}

interface TakeNextFallbackParams {
  queue: PatchFetchTarget[]
  // What the failed attempt answered; nothing when it did not answer at all.
  upstreamStatus?: number
  readBudgetHold: () => Promise<AppBudgetHold | undefined>
}

// The next fallback worth trying: one that can only repeat a 404 is passed
// over, and so is one that would spend the app's budget while a hold is on it.
async function takeNextFallback({
  queue,
  upstreamStatus,
  readBudgetHold,
}: TakeNextFallbackParams): Promise<PatchFetchTarget | undefined> {
  for (;;) {
    const next = queue.shift()
    if (isNullish(next)) {
      return undefined
    }
    if (upstreamStatus === 404 && next.skipAfterNotFound === true) {
      continue
    }
    const hold = next.auth === 'app' ? await readBudgetHold() : undefined
    if (isNullish(hold)) {
      return next
    }
    logAppFallbackWithheld({target: next, hold})
  }
}

interface FetchPatchTargetParams<T extends PatchFetchTarget> {
  target: T
  signal: AbortSignal
  fetcher: DiffFetch
}

function fetchPatchTarget({
  target,
  signal,
  fetcher,
}: FetchPatchTargetParams<PatchFetchTarget>): Promise<PatchFetchResult> {
  if (target.kind === 'github-pull') {
    return fetchGitHubPullPatchTarget({target, signal, fetcher})
  }

  return fetchDirectPatchTarget({target, signal, fetcher})
}

async function fetchDirectPatchTarget({
  target,
  signal,
  fetcher,
}: FetchPatchTargetParams<DirectPatchFetchTarget>): Promise<PatchFetchResult> {
  const response = await fetcher(target.patchURL, {
    cache: 'no-store',
    headers: {'User-Agent': 'revision-city-diffs', ...target.requestHeaders},
    signal,
  })
  return {response, target}
}

async function fetchGitHubPullPatchTarget({
  target,
  signal,
  fetcher,
}: FetchPatchTargetParams<GitHubPullPatchFetchTarget>): Promise<PatchFetchResult> {
  const pullResponse = await fetcher(target.pullURL, {
    cache: 'no-store',
    headers: {'User-Agent': 'revision-city-diffs', ...target.requestHeaders},
    signal,
  })

  const pullTarget: DirectPatchFetchTarget = {
    auth: target.auth,
    label: target.label,
    patchURL: target.pullURL,
    requestHeaders: target.requestHeaders,
    sourceURL: target.sourceURL,
  }
  if (!pullResponse.ok) {
    return {response: pullResponse, target: pullTarget}
  }

  const pullData = await pullResponse.json()
  const baseSha = readStringPath(pullData, ['base', 'sha'])
  const headSha = readStringPath(pullData, ['head', 'sha'])
  const baseRepo = readRepoFullName(pullData, ['base', 'repo', 'full_name'])
  const headRepo = readRepoFullName(pullData, ['head', 'repo', 'full_name'])
  if (isNullish(baseSha) || isNullish(headSha)) {
    return {
      response: new Response('GitHub pull response did not include refs.', {
        status: 502,
      }),
      target: pullTarget,
    }
  }

  const compareBaseRepo = baseRepo ?? target.repo
  const compareHeadRepo = headRepo ?? compareBaseRepo
  const compareRange = isSameGitHubRepo(compareBaseRepo, compareHeadRepo)
    ? `${baseSha}...${headSha}`
    : `${compareBaseRepo.owner}:${baseSha}...${compareHeadRepo.owner}:${headSha}`

  return fetchDirectPatchTarget({
    target: {
      auth: target.auth,
      patchURL: createGitHubApiUrl(
        `/repos/${encodeURLSegment(compareBaseRepo.owner)}/${encodeURLSegment(compareBaseRepo.repo)}/compare/${encodeURLSegment(compareRange)}`,
      ),
      label: target.compareLabel,
      requestHeaders: createGitHubDiffAPIHeaders(target.authorization),
      sourceURL: target.sourceURL,
    },
    signal,
    fetcher,
  })
}

// What went wrong at the transport level, before anyone is asked why: a status,
// a body that is not a diff, or a diff with nothing in it.
function readPatchResponseFailure(
  response: Response,
  target: DirectPatchFetchTarget,
): PatchFailure | undefined {
  if (!response.ok) {
    return {
      status: response.status >= 400 ? response.status : 502,
      message: `Failed to fetch patch from ${target.label ?? 'upstream'}: ${describeStatus(response)}.`,
    }
  }

  const contentType = response.headers.get('Content-Type')
  if (isNullish(contentType) || !isDiffContentType(contentType)) {
    return {status: 415, message: NON_DIFF_RESPONSE_MESSAGE}
  }

  if (response.headers.get('Content-Length') === '0') {
    return {status: 422, message: EMPTY_PATCH_MESSAGE}
  }

  return undefined
}

interface ExplainPatchFailureParams {
  failure: PatchFailure
  response: Response
  target: DirectPatchFetchTarget
  viewer: DiffViewerAuth
  fetcher: DiffFetch
}

// Turns the last attempt's failure into something the visitor can act on. A
// diagnosed access failure replaces the transport-level message wholesale: it
// names the actual obstacle and carries the step out of it, where
// "authenticated pull metadata: 404 Not Found" only names the attempt. Asked
// once, of the final attempt, since the answer for an earlier one is discarded.
async function explainPatchFailure({
  failure,
  response,
  target,
  viewer,
  fetcher,
}: ExplainPatchFailureParams): Promise<PatchFailure> {
  if (response.ok) {
    return failure
  }

  const source = readGitHubSourceFromURL(target.sourceURL)
  const accessFailure = await diagnoseGitHubAccess({
    fetch: fetcher,
    login: viewer.login,
    source,
    status: failure.status,
    token: viewer.token,
  })
  if (!isNullish(accessFailure)) {
    return {...accessFailure, status: failure.status}
  }

  const anonymousFailure = describeAnonymousUpstreamFailure({response, source, viewer})
  return isNullish(anonymousFailure) ? failure : {...anonymousFailure, status: failure.status}
}

interface DescribeAnonymousUpstreamFailureParams {
  response: Response
  source: GitHubDiffSource | undefined
  viewer: DiffViewerAuth
}

// GitHub turning away a signed-out request with an outage-shaped status is not
// the last word on the diff: a signed-in visitor's request travels routes the
// anonymous one cannot, and gets through when this one does not. So the panel
// offers the sign-in rather than a bare status. Only for GitHub sources, since
// signing in does nothing for a tangled.org patch.
function describeAnonymousUpstreamFailure({
  response,
  source,
  viewer,
}: DescribeAnonymousUpstreamFailureParams): Omit<PatchFailure, 'status'> | undefined {
  if (!isNullish(viewer.token) || isNullish(source)) {
    return undefined
  }
  if (response.status !== 429 && response.status < 500) {
    return undefined
  }
  return {
    message: `GitHub turned away the anonymous request for this diff with ${describeStatus(response)}. Signing in with GitHub requests it with your account instead.`,
    remedy: {kind: 'sign-in'},
  }
}

// The status with its reason phrase when the upstream sent one; HTTP/2 carries
// none, and "503 " reads like a typo.
function describeStatus(response: Response): string {
  return response.statusText === ''
    ? String(response.status)
    : `${response.status} ${response.statusText}`
}

interface LogUpstreamFailureParams {
  target: PatchFetchTarget
  viewer: DiffViewerAuth
  response?: Response
  error?: unknown
}

// One structured line per failed attempt, for Workers Logs: which route was
// tried as whom, what GitHub answered, and its throttling headers, so the next
// signed-out 503 can be told from a rate limit without reproducing it. A handled
// failure is not an exception, so nothing else records it.
function logUpstreamFailure({target, viewer, response, error}: LogUpstreamFailureParams): void {
  console.warn(UPSTREAM_FAILURE_LOG_MESSAGE, {
    target: target.label ?? 'upstream',
    url: target.kind === 'github-pull' ? target.pullURL : target.patchURL,
    source: target.sourceURL,
    signedIn: !isNullish(viewer.token),
    status: response?.status,
    retryAfter: response?.headers.get('retry-after') ?? undefined,
    rateLimitRemaining: response?.headers.get('x-ratelimit-remaining') ?? undefined,
    rateLimitReset: response?.headers.get('x-ratelimit-reset') ?? undefined,
    error: isNullish(error) ? undefined : describeError(error),
  })
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}

interface LogAppFallbackWithheldParams {
  target: PatchFetchTarget
  hold: AppBudgetHold
}

// The line behind a signed-out failure with no fallback attempt on record: the
// app's credentials were on hold, and this is why.
function logAppFallbackWithheld({target, hold}: LogAppFallbackWithheldParams): void {
  console.warn(APP_FALLBACK_WITHHELD_LOG_MESSAGE, {
    target: target.label ?? 'upstream',
    source: target.sourceURL,
    hold,
  })
}

function readGitHubSourceFromURL(sourceURL: string | undefined): GitHubDiffSource | undefined {
  if (isNullish(sourceURL)) {
    return undefined
  }

  try {
    const url = new URL(sourceURL)
    if (url.hostname !== GITHUB_HOST) {
      return undefined
    }
    return parseGitHubDiffSource(url.pathname)
  } catch {
    return undefined
  }
}

function readRepoFullName(data: unknown, path: readonly string[]): GitHubRepo | undefined {
  const fullName = readStringPath(data, path)
  if (isNullish(fullName)) {
    return undefined
  }

  const separatorIndex = fullName.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === fullName.length - 1) {
    return undefined
  }
  return {
    owner: fullName.slice(0, separatorIndex),
    repo: fullName.slice(separatorIndex + 1),
  }
}

function isSameGitHubRepo(a: GitHubRepo, b: GitHubRepo): boolean {
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase()
  )
}

function readStringPath(data: unknown, path: readonly string[]): string | undefined {
  let current = data
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[key]
  }
  return typeof current === 'string' ? current : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDiffContentType(contentType: string): boolean {
  const normalizedContentType = contentType.toLowerCase()
  return (
    normalizedContentType.startsWith('text/plain') ||
    (normalizedContentType.includes('application/vnd.github') &&
      normalizedContentType.includes('diff'))
  )
}

// Forwards each validated upstream diff chunk into the client stream.
async function pumpPatchBody(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  try {
    const reader = body.getReader()
    let sawContent = false
    try {
      for (;;) {
        const result = await reader.read()
        if (result.done) {
          break
        }

        if (result.value.byteLength > 0) {
          sawContent = true
          controller.enqueue(result.value)
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!sawContent) {
      throw new Error(EMPTY_PATCH_MESSAGE)
    }

    controller.close()
  } catch (error) {
    controller.error(error)
  }
}

// Centralizes text response headers for both stream and error bodies. Diff
// responses are intentionally not cached in the browser because cached 100MB+
// responses can replay poorly and delay the first useful diff bytes.
function createTextResponse(
  body: string | ReadableStream<Uint8Array>,
  {status = 200, sourceURL}: TextResponseOptions = {},
): Response {
  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': CACHE_CONTROL,
    Vary: 'Cookie',
  })
  if (!isNullish(sourceURL)) {
    headers.set('X-Patch-Source', sourceURL)
  }
  return new Response(body, {
    status,
    headers,
  })
}

// Failures answer in JSON so the viewer can render the way out as a button
// rather than as one more sentence of prose the reader has to act on manually.
function createErrorResponse({
  message,
  remedy,
  sourceURL,
  status,
}: PatchFailure & {sourceURL?: string}): Response {
  const headers = new Headers({'Cache-Control': CACHE_CONTROL, Vary: 'Cookie'})
  if (!isNullish(sourceURL)) {
    headers.set('X-Patch-Source', sourceURL)
  }
  return Response.json({message, remedy}, {status, headers})
}
