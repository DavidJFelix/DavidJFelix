import type {BrowserOptions, ErrorEvent} from '@sentry/react'

// Sentry gets route templates, not repository paths: the viewer and share-card paths name the
// owner, the repository, the pull request and the files, and the diff API query names them too.

type SentrySpan = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0]

const PATH_TEMPLATE = '$path'
const TEMPLATED_PATH_PREFIXES = ['/diffs/', '/og/diffs/']
const DIFF_API_PREFIX = '/api/diffs/'
const PATH_PARAMETER_ATTRIBUTE_PREFIXES = ['url.path.parameter.', 'params.']
const QUERY_ATTRIBUTES = new Set(['url.query', 'http.query'])
const FRAGMENT_ATTRIBUTES = new Set(['url.fragment', 'http.fragment'])

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

const isStringAttributeObject = (value: unknown): value is {value: string} =>
  typeof value === 'object' && value !== null && 'value' in value && typeof value.value === 'string'

interface ScrubSentrySpanParams {
  span: SentrySpan
  origin: string
}

export function scrubSentrySpan({span, origin}: ScrubSentrySpanParams): SentrySpan {
  const template = (url: string): string => templateSiteUrl({url, origin})
  const callsDiffApi = Object.values(span.attributes).some(
    (value) => typeof value === 'string' && isDiffApiUrl({url: value, origin}),
  )
  const isKept = (key: string): boolean =>
    !PATH_PARAMETER_ATTRIBUTE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
    !FRAGMENT_ATTRIBUTES.has(key) &&
    !(callsDiffApi && QUERY_ATTRIBUTES.has(key))
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
}

interface TemplateStringsParams<T> {
  record: Record<string, T>
  origin: string
}

function templateStrings<T>({
  record,
  origin,
}: TemplateStringsParams<T>): Record<string, T | string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' ? templateSiteUrl({url: value, origin}) : value,
    ]),
  )
}

type Breadcrumb = NonNullable<ErrorEvent['breadcrumbs']>[number]

interface TemplateBreadcrumbParams {
  breadcrumb: Breadcrumb
  origin: string
}

function templateBreadcrumb({breadcrumb, origin}: TemplateBreadcrumbParams): Breadcrumb {
  if (breadcrumb.data === undefined) return breadcrumb
  return {...breadcrumb, data: templateStrings({record: breadcrumb.data, origin})}
}

export function scrubSentryEvent({event, origin}: ScrubSentryEventParams): ErrorEvent {
  const {transaction, request, breadcrumbs} = event
  return {
    ...event,
    ...(transaction !== undefined && {transaction: templateSiteUrl({url: transaction, origin})}),
    ...(request !== undefined && {
      request: {
        ...request,
        ...(request.url !== undefined && {url: templateSiteUrl({url: request.url, origin})}),
        ...(request.headers !== undefined && {
          headers: templateStrings({record: request.headers, origin}),
        }),
      },
    }),
    ...(breadcrumbs !== undefined && {
      breadcrumbs: breadcrumbs.map((breadcrumb) => templateBreadcrumb({breadcrumb, origin})),
    }),
  }
}
