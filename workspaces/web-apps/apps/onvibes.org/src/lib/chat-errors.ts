// User-facing copy for a failed reply. The chat client reports a rejected
// request as an Error whose message carries the HTTP status ("HTTP error!
// status: 503 Service Unavailable"); everything else (network, aborted
// upstream) gets the generic line.

const UNCONFIGURED_STATUS = 503

export function describeChatError(error: Error): string {
  const status = Number(/status: (\d{3})/u.exec(error.message)?.[1])
  if (status === UNCONFIGURED_STATUS) return 'Chat is not set up on this server yet.'
  return 'The reply did not come through.'
}
