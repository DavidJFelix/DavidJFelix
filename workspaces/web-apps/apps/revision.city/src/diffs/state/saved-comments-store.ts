import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

import {isNullish} from '@/diffs/lib/nullish'
import {removeSavedCommentSidebarEntry} from '@/diffs/lib/remove-saved-comment-sidebar-entry'
import type {
  DiffsCommentFileByItemId,
  DiffsSavedCommentEvent,
  DiffsSavedCommentItem,
} from '@/diffs/lib/types'
import {upsertSavedCommentSidebarEntry} from '@/diffs/lib/upsert-saved-comment-sidebar-entry'

const commentFileByItemIdSchema = z.custom<DiffsCommentFileByItemId>()

const savedCommentEventSchema = z.custom<DiffsSavedCommentEvent>()

const savedCommentItemSchema = z.custom<DiffsSavedCommentItem>()

const savedCommentsContextSchema = z.readonly(
  z.object({sections: z.readonly(z.array(savedCommentItemSchema))}),
)

const savedCommentsEventSchemas = {
  commentSaved: z.object({
    comment: savedCommentEventSchema,
    files: z.nullable(commentFileByItemIdSchema),
  }),
  commentDeleted: z.object({itemId: z.string(), key: z.string()}),
  cleared: z.object({}),
}

export type SavedCommentsContext = z.infer<typeof savedCommentsContextSchema>

export const savedCommentsLogic = createStoreLogic({
  schemas: {context: savedCommentsContextSchema, events: savedCommentsEventSchemas},
  context: (): SavedCommentsContext => ({sections: []}),
  on: {
    commentSaved: (context, {comment, files}) => {
      if (isNullish(files) || !files.has(comment.itemId)) {
        return undefined
      }
      return {sections: upsertSavedCommentSidebarEntry(context.sections, files, comment)}
    },
    commentDeleted: (context, {itemId, key}) => {
      const listed = context.sections.some(
        (section) =>
          section.itemId === itemId && section.comments.some((comment) => comment.key === key),
      )
      if (!listed) {
        return undefined
      }
      return {sections: removeSavedCommentSidebarEntry(context.sections, {itemId, key})}
    },
    cleared: () => ({sections: []}),
  },
})

export type SavedCommentsStore = ReturnType<typeof savedCommentsLogic.createStore>
