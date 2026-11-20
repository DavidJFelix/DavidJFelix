import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import {getPatchViewerHref, toPatchViewerLocation} from '@/diffs/lib/get-patch-viewer-href'

// `submitting` starts at the Enter key press. A blur in that status comes from
// Enter, so it does not restore the committed URL. The submit event ends the
// status, and so do typing, Escape, and the clear button.
export type DiffUrlFormStatus = 'editing' | 'invalid' | 'submitting'

export interface DiffUrlFormContext {
  committedUrl: string
  status: DiffUrlFormStatus
  url: string
}

interface DiffUrlFormInput {
  committedUrl: string
}

function edited(context: DiffUrlFormContext, url: string): DiffUrlFormContext {
  return {...context, status: 'editing', url}
}

export const diffUrlFormLogic = createStoreLogic({
  context: ({committedUrl}: DiffUrlFormInput): DiffUrlFormContext => ({
    committedUrl,
    status: 'editing',
    url: committedUrl,
  }),
  schemas: {
    emitted: {
      accepted: z.object({domain: z.optional(z.string()), splat: z.string()}),
      rejected: z.object({}),
    },
  },
  on: {
    changed: (context, {url}: {url: string}) => edited(context, url),
    cleared: (context) => edited(context, ''),
    escaped: (context) => edited(context, context.committedUrl),
    blurred: (context) =>
      context.status === 'submitting' || context.url.trim() !== ''
        ? undefined
        : edited(context, context.committedUrl),
    enterPressed: (context): DiffUrlFormContext => ({...context, status: 'submitting'}),
    submitted: (context, _event, enqueue): DiffUrlFormContext => {
      const url = context.url.trim()
      const viewerHref = getPatchViewerHref(url)
      if (viewerHref === undefined) {
        enqueue.emit.rejected({})
        return {...context, status: 'invalid'}
      }
      enqueue.emit.accepted(toPatchViewerLocation(viewerHref))
      return edited(context, url)
    },
  },
})
