import type {SeverityLevel} from '@sentry/cloudflare'
import {SENTRY_TUNNEL_ROUTE} from '@/lib/sentry-tunnel'
import {templateSiteUrl} from '@/lib/telemetry-scrub'

export type CaptureMessage = (message: string, level: SeverityLevel) => void

export interface ReportServerErrorResponseParams {
  request: Request
  response: Response
  captureMessage: CaptureMessage
}

// withSentry captures only thrown errors. A route that catches a failure and
// answers 5xx, such as the GitHub sign-in callback, is otherwise invisible in
// Sentry. The message has the route template of the path, such as
// `/diffs/$path`, and not the query. So one route and status make one issue,
// and no repository path or query value, such as an OAuth code, gets into the
// title. The console breadcrumbs of the request go with the event.
//
// The Sentry tunnel is not reported. Its 5xx is the answer of Sentry ingest,
// which the tunnel passes on to the browser. A report of that answer goes to
// the same Sentry that failed, and it is not a failure of this app.
export function reportServerErrorResponse({
  request,
  response,
  captureMessage,
}: ReportServerErrorResponseParams): void {
  if (response.status < 500) {
    return
  }
  const {pathname, origin} = new URL(request.url)
  if (pathname === SENTRY_TUNNEL_ROUTE) {
    return
  }
  const route = templateSiteUrl({url: pathname, origin})
  captureMessage(`${request.method} ${route} answered ${response.status}`, 'error')
}
