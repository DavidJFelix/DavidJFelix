import type {BrowserOptions, ErrorEvent} from '@sentry/react'

// Sentry gets route templates, not repository paths: the viewer and share-card paths name the
// owner, the repository, the pull request and the files, and the diff API query names them too.

// What a URL on another host keeps. The browser keeps the full URL. The server keeps the origin
// only, because the paths and queries of its calls to GitHub, Codeberg and the model provider name
// the repository.
export type OtherHostUrls = 'keep' | 'origin'

type SentrySpan = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0]

const PATH_TEMPLATE = '$path'
const TEMPLATED_PATH_PREFIXES = ['/diffs/', '/og/diffs/']
const DIFF_API_PREFIX = '/api/diffs/'
const PATH_PARAMETER_ATTRIBUTE_PREFIXES = ['url.path.parameter.', 'params.']
const QUERY_ATTRIBUTES = new Set(['url.query', 'http.query'])
const FRAGMENT_ATTRIBUTES = new Set(['url.fragment', 'http.fragment'])
const HTTP_URL = /^https?:\/\//
// A span or transaction name such as `GET /diffs/owner/repo`.
const METHOD_AND_URL = /^([A-Z]+) (\S+)$/

interface SiteUrlParams {
  url: string
  origin: string
}

// The part of `url` after the origin, or undefined when `url` is not on this site.
function sitePath({url, origin}: SiteUrlParams): string | undefined {
  if (url.startsWith(`${origin}/`)) return url.slice(origin.length)
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return undefined
}

const beforeFirst = (value: string, separator: string): string => {
  const index = value.indexOf(separator)
  return index === -1 ? value : value.slice(0, index)
}

const isDiffApiUrl = (params: SiteUrlParams): boolean =>
  sitePath(params)?.startsWith(DIFF_API_PREFIX) ?? false

export function templateSiteUrl({url, origin}: SiteUrlParams): string {
  const path = sitePath({url, origin})
  if (path === undefined) return url
  const pathAndQuery = beforeFirst(path, '#')
  const pathname = beforeFirst(pathAndQuery, '?')
  const query = pathname.startsWith(DIFF_API_PREFIX) ? '' : pathAndQuery.slice(pathname.length)
  const prefix = TEMPLATED_PATH_PREFIXES.find(
    (candidate) => pathname.startsWith(candidate) && pathname.length > candidate.length,
  )
  const templatedPathname = prefix === undefined ? pathname : `${prefix}${PATH_TEMPLATE}`
  return `${url.slice(0, url.length - path.length)}${templatedPathname}${query}`
}

interface TemplateParams extends SiteUrlParams {
  otherHostUrls: OtherHostUrls
}

const isOtherHostUrl = ({url, origin}: SiteUrlParams): boolean =>
  sitePath({url, origin}) === undefined && HTTP_URL.test(url) && URL.canParse(url)

function templateUrl({url, origin, otherHostUrls}: TemplateParams): string {
  if (otherHostUrls === 'origin' && isOtherHostUrl({url, origin})) return new URL(url).origin
  return templateSiteUrl({url, origin})
}

function templateUrlOrName(params: TemplateParams): string {
  const match = METHOD_AND_URL.exec(params.url)
  if (match === null) return templateUrl(params)
  const [, method, url] = match
  return `${method} ${templateUrl({...params, url})}`
}

const isStringAttributeObject = (value: unknown): value is {value: string} =>
  typeof value === 'object' && value !== null && 'value' in value && typeof value.value === 'string'

interface ScrubSentrySpanParams {
  span: SentrySpan
  origin: string
  otherHostUrls?: OtherHostUrls
}

export function scrubSentrySpan({
  span,
  origin,
  otherHostUrls = 'keep',
}: ScrubSentrySpanParams): SentrySpan {
  const template = (url: string): string => templateUrlOrName({url, origin, otherHostUrls})
  const callsWith = (isMatch: (params: SiteUrlParams) => boolean): boolean =>
    Object.values(span.attributes).some(
      (value) => typeof value === 'string' && isMatch({url: value, origin}),
    )
  const dropsQuery =
    callsWith(isDiffApiUrl) || (otherHostUrls === 'origin' && callsWith(isOtherHostUrl))
  const isKept = (key: string): boolean =>
    !PATH_PARAMETER_ATTRIBUTE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
    !FRAGMENT_ATTRIBUTES.has(key) &&
    !(dropsQuery && QUERY_ATTRIBUTES.has(key))
  const templateValue = (value: unknown): unknown => {
    if (typeof value === 'string') return template(value)
    if (isStringAttributeObject(value)) return {...value, value: template(value.value)}
    return value
  }
  const attributes = Object.fromEntries(
    Object.entries(span.attributes)
      .filter(([key]) => isKept(key))
      .map(([key, value]) => [key, templateValue(value)]),
  )
  return {...span, name: template(span.name), attributes}
}

interface ScrubSentryEventParams {
  event: ErrorEvent
  origin: string
  otherHostUrls?: OtherHostUrls
}

interface TemplateStringsParams<T> {
  record: Record<string, T>
  origin: string
  otherHostUrls: OtherHostUrls
}

function templateStrings<T>({
  record,
  origin,
  otherHostUrls,
}: TemplateStringsParams<T>): Record<string, T | string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' ? templateUrlOrName({url: value, origin, otherHostUrls}) : value,
    ]),
  )
}

type Breadcrumb = NonNullable<ErrorEvent['breadcrumbs']>[number]

interface TemplateBreadcrumbParams {
  breadcrumb: Breadcrumb
  origin: string
  otherHostUrls: OtherHostUrls
}

function templateBreadcrumb({breadcrumb, ...params}: TemplateBreadcrumbParams): Breadcrumb {
  if (breadcrumb.data === undefined) return breadcrumb
  return {...breadcrumb, data: templateStrings({record: breadcrumb.data, ...params})}
}

export function scrubSentryEvent({
  event,
  origin,
  otherHostUrls = 'keep',
}: ScrubSentryEventParams): ErrorEvent {
  const {transaction, request, breadcrumbs} = event
  const template = (url: string): string => templateUrlOrName({url, origin, otherHostUrls})
  const {query_string: queryString, ...requestWithoutQuery} = request ?? {}
  const callsDiffApi = request?.url !== undefined && isDiffApiUrl({url: request.url, origin})
  return {
    ...event,
    ...(transaction !== undefined && {transaction: template(transaction)}),
    ...(request !== undefined && {
      request: {
        ...requestWithoutQuery,
        ...(queryString !== undefined && !callsDiffApi && {query_string: queryString}),
        ...(request.url !== undefined && {url: template(request.url)}),
        ...(request.headers !== undefined && {
          headers: templateStrings({record: request.headers, origin, otherHostUrls}),
        }),
      },
    }),
    ...(breadcrumbs !== undefined && {
      breadcrumbs: breadcrumbs.map((breadcrumb) =>
        templateBreadcrumb({breadcrumb, origin, otherHostUrls}),
      ),
    }),
  }
}

const HTTP_BREADCRUMB_TYPE = 'http'
// The server's only `console.log` writes the wide events. A wide event can name a repository in
// many of its fields, so Sentry does not get these breadcrumbs.
const WIDE_EVENT_LEVEL = 'log'
const REPOSITORY_KEY = 'repository'

interface ScrubLogValueParams {
  value: unknown
  origin: string
}

function scrubLogValue({value, origin}: ScrubLogValueParams): unknown {
  if (typeof value === 'string')
    return templateUrlOrName({url: value, origin, otherHostUrls: 'origin'})
  if (Array.isArray(value))
    return value.map((item: unknown) => scrubLogValue({value: item, origin}))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== REPOSITORY_KEY)
      .map(([key, item]) => [key, scrubLogValue({value: item, origin})]),
  )
}

const formatLogValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

interface ScrubServerBreadcrumbParams {
  breadcrumb: Breadcrumb
  origin: string
}

// The console breadcrumbs keep the logged objects as they are, so this scrubs them on the way to
// Sentry and leaves Workers Logs and Honeycomb with the full lines.
export function scrubServerBreadcrumb({
  breadcrumb,
  origin,
}: ScrubServerBreadcrumbParams): Breadcrumb | null {
  if (breadcrumb.category === 'console') {
    if (breadcrumb.level === WIDE_EVENT_LEVEL) return null
    const logged: unknown = breadcrumb.data?.arguments
    const values = Array.isArray(logged)
      ? logged.map((value: unknown) => scrubLogValue({value, origin}))
      : []
    return {
      ...breadcrumb,
      message: values.map(formatLogValue).join(' '),
      data: {...breadcrumb.data, arguments: values},
    }
  }
  const templated = templateBreadcrumb({breadcrumb, origin, otherHostUrls: 'origin'})
  if (templated.type !== HTTP_BREADCRUMB_TYPE || templated.data === undefined) return templated
  const data = Object.fromEntries(
    Object.entries(templated.data).filter(
      ([key]) => !QUERY_ATTRIBUTES.has(key) && !FRAGMENT_ATTRIBUTES.has(key),
    ),
  )
  return {...templated, data}
}
