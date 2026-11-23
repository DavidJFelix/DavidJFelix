import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import {getPatchViewerHref, toPatchViewerLocation} from '@/diffs/lib/get-patch-viewer-href'

const diffUrlFormInputSchema = z.readonly(z.object({committedUrl: z.string()}))

const diffUrlFormContextSchema = z.readonly(
  z.object({
    committedUrl: z.string(),
    // `submitting` starts at the Enter key press. A blur in that status comes from
    // Enter, so it does not restore the committed URL. The submit event ends the
    // status, and so do typing, Escape, and the clear button.
    status: z.enum(['editing', 'invalid', 'submitting']),
    url: z.string(),
  }),
)

const diffUrlFormEventSchemas = {
  changed: z.object({url: z.string()}),
  cleared: z.object({}),
  escaped: z.object({}),
  blurred: z.object({}),
  enterPressed: z.object({}),
  submitted: z.object({}),
}

const diffUrlFormEmittedSchemas = {
  accepted: z.object({domain: z.optional(z.string()), splat: z.string()}),
  rejected: z.object({}),
}

type DiffUrlFormInput = z.infer<typeof diffUrlFormInputSchema>

export type DiffUrlFormContext = z.infer<typeof diffUrlFormContextSchema>

export type DiffUrlFormStatus = DiffUrlFormContext['status']

function edited(context: DiffUrlFormContext, url: string): DiffUrlFormContext {
  return {...context, status: 'editing', url}
}

export const diffUrlFormLogic = createStoreLogic({
  schemas: {
    context: diffUrlFormContextSchema,
    events: diffUrlFormEventSchemas,
    emitted: diffUrlFormEmittedSchemas,
  },
  context: ({committedUrl}: DiffUrlFormInput): DiffUrlFormContext => ({
    committedUrl,
    status: 'editing',
    url: committedUrl,
  }),
  on: {
    changed: (context, {url}) => edited(context, url),
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
