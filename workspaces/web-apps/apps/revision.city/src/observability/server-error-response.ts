import type {SeverityLevel} from '@sentry/cloudflare'

export type CaptureMessage = (message: string, level: SeverityLevel) => void

export interface ReportServerErrorResponseParams {
  request: Request
  response: Response
  captureMessage: CaptureMessage
}

// withSentry captures only thrown errors. A route that catches a failure and
// answers 5xx, such as the GitHub sign-in callback, is otherwise invisible in
// Sentry. The message has the path and not the query. So one route and status
// make one issue, and a query value such as an OAuth code stays out of the
// title. The console breadcrumbs of the request go with the event.
export function reportServerErrorResponse({
  request,
  response,
  captureMessage,
}: ReportServerErrorResponseParams): void {
  if (response.status < 500) {
    return
  }
  const {pathname} = new URL(request.url)
  captureMessage(`${request.method} ${pathname} answered ${response.status}`, 'error')
}
