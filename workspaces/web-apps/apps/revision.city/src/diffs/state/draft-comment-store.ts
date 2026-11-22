import {
  type AnnotationSide,
  areSelectionsEqual,
  type CodeViewLineSelection,
  type SelectedLineRange,
} from '@pierre/diffs'
import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import type {AvatarName} from '@/diffs/lib/annotation'

const annotationSideSchema = z.custom<AnnotationSide>()

const avatarNameSchema = z.custom<AvatarName>()

const lineSelectionSchema = z.custom<CodeViewLineSelection>()

const selectedLineRangeSchema = z.custom<SelectedLineRange>()

const commentKeyShape = {itemId: z.string(), key: z.string()}

const draftCommentShape = {
  ...commentKeyShape,
  lineNumber: z.number(),
  range: selectedLineRangeSchema,
  side: annotationSideSchema,
}

const draftCommentSchema = z.readonly(z.object(draftCommentShape))

const draftCommentsShape = {
  draftCount: z.number(),
  selectedLines: z.nullable(lineSelectionSchema),
}

// The viewer keeps the draft in the `annotations` of its item. `DraftAnnotation` keeps the text.
const draftCommentContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({...draftCommentsShape, draft: z.optional(z.undefined()), status: z.literal('idle')}),
    z.object({...draftCommentsShape, draft: draftCommentSchema, status: z.literal('drafting')}),
  ]),
)

const commentKeySchema = z.object(commentKeyShape)

const draftCommentEventSchemas = {
  linesSelected: z.object({selection: z.nullable(lineSelectionSchema)}),
  commentClicked: z.object({selection: lineSelectionSchema}),
  gutterClicked: z.object({itemId: z.string(), range: selectedLineRangeSchema}),
  removeRequested: commentKeySchema,
  saveRequested: z.object({...commentKeyShape, author: avatarNameSchema, message: z.string()}),
}

const draftCommentEmittedSchemas = {
  draftDiscarded: commentKeySchema,
  draftOpened: z.object(draftCommentShape),
  commentRemoved: commentKeySchema,
  draftSaved: z.object({...draftCommentShape, author: avatarNameSchema, message: z.string()}),
}

export type DraftComment = z.infer<typeof draftCommentSchema>

export type DraftCommentContext = z.infer<typeof draftCommentContextSchema>

type DraftingContext = Extract<DraftCommentContext, {status: 'drafting'}>

export const draftCommentLogic = createStoreLogic({
  schemas: {
    context: draftCommentContextSchema,
    events: draftCommentEventSchemas,
    emitted: draftCommentEmittedSchemas,
  },
  context: (): DraftCommentContext => ({draftCount: 0, selectedLines: null, status: 'idle'}),
  on: {
    linesSelected: (context, {selection}) => ({...context, selectedLines: selection}),
    commentClicked: (context, {selection}) => ({
      ...context,
      selectedLines: isSameSelection(context.selectedLines, selection) ? null : selection,
    }),
    gutterClicked: (context, {itemId, range}, enqueue): DraftCommentContext | undefined => {
      const side = range.endSide ?? range.side
      if (side === undefined) {
        return undefined
      }
      const draft = {itemId, key: `draft-${context.draftCount}`, lineNumber: range.end, range, side}
      // `draftOpened` replaces each draft of its own file, so only a draft on another file
      // needs `draftDiscarded`.
      if (context.status === 'drafting' && context.draft.itemId !== itemId) {
        enqueue.emit.draftDiscarded({itemId: context.draft.itemId, key: context.draft.key})
      }
      enqueue.emit.draftOpened(draft)
      return {
        draft,
        draftCount: context.draftCount + 1,
        selectedLines: context.selectedLines,
        status: 'drafting',
      }
    },
    removeRequested: (context, {itemId, key}, enqueue): DraftCommentContext => {
      enqueue.emit.commentRemoved({itemId, key})
      return isOpenDraft(context, key) ? withoutDraft(context) : {...context, selectedLines: null}
    },
    saveRequested: (context, {author, itemId, key, message}, enqueue) => {
      const trimmedMessage = message.trim()
      if (!isOpenDraft(context, key) || trimmedMessage === '') {
        return undefined
      }
      enqueue.emit.draftSaved({...context.draft, author, itemId, message: trimmedMessage})
      return withoutDraft(context)
    },
  },
})

function isSameSelection(
  selection: CodeViewLineSelection | null,
  other: CodeViewLineSelection,
): boolean {
  return selection?.id === other.id && areSelectionsEqual(selection.range, other.range)
}

// Each draft gets a new `key`, so the `key` alone names the open draft. The viewer can change the
// `itemId` of a file during a streamed load.
function isOpenDraft(context: DraftCommentContext, key: string): context is DraftingContext {
  return context.status === 'drafting' && context.draft.key === key
}

function withoutDraft(context: DraftCommentContext): DraftCommentContext {
  return {draftCount: context.draftCount, selectedLines: null, status: 'idle'}
}
