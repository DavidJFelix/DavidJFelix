import type {ViewerLoadState} from './types'

// The patch is the first wait. When the patch shows, the highlighter can still
// be starting, and no file shows until it is ready.
export type StatusPanelWait = 'patch' | 'highlighter'

interface StatusPanelTextParams {
  errorMessage: string | null
  sourceName: string
  state: ViewerLoadState
  waitingFor: StatusPanelWait
}

interface StatusPanelText {
  message: string
  title: string
}

export function statusPanelText({
  errorMessage,
  sourceName,
  state,
  waitingFor,
}: StatusPanelTextParams): StatusPanelText {
  if (state === 'error') {
    return {
      title: 'Couldn’t load diff',
      message: errorMessage ?? 'Failed to fetch the diff, please try again.',
    }
  }
  if (waitingFor === 'highlighter') {
    return {
      title: 'Starting syntax highlighting',
      message: 'The files show when the highlighter is ready…',
    }
  }
  if (state === 'parsing') {
    return {title: 'Preparing diff', message: 'Parsing the patch and building the file tree…'}
  }
  if (state === 'fetching') {
    return {title: 'Fetching diff', message: `Fetching the patch from ${sourceName}…`}
  }
  return {title: 'Streaming diff', message: 'Reading the patch and showing files as they arrive…'}
}
