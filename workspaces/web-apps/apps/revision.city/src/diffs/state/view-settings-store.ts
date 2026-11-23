import type {DiffIndicators} from '@pierre/diffs'
import {createStoreLogic, type StoreFromStoreLogicCreator} from '@xstate/store'
import * as z from 'zod/mini'

const diffIndicatorsSchema = z.custom<DiffIndicators>()

const collapseModeSchema = z.enum(['expanded', 'collapsed'])

const diffStyleSchema = z.enum(['split', 'unified'])

const overflowSchema = z.enum(['wrap', 'scroll'])

// On a wide viewport the file tree has its own column, so the overlay is `forced-closed`.
const fileTreeOverlayStatusSchema = z.enum(['closed', 'open', 'forced-closed'])

const viewSettingsContextSchema = z.readonly(
  z.object({
    collapseMode: collapseModeSchema,
    diffIndicators: diffIndicatorsSchema,
    diffStyle: diffStyleSchema,
    lineNumbers: z.boolean(),
    overflow: overflowSchema,
    showBackgrounds: z.boolean(),
    status: fileTreeOverlayStatusSchema,
  }),
)

const viewSettingsEventSchemas = {
  collapseModeToggled: z.object({}),
  diffIndicatorsChanged: z.object({diffIndicators: diffIndicatorsSchema}),
  diffStyleChanged: z.object({diffStyle: diffStyleSchema}),
  lineNumbersChanged: z.object({lineNumbers: z.boolean()}),
  overflowChanged: z.object({overflow: overflowSchema}),
  showBackgroundsChanged: z.object({showBackgrounds: z.boolean()}),
  fileTreeOverlayToggled: z.object({}),
  fileTreeOverlayClosed: z.object({}),
  viewportChanged: z.object({mobile: z.boolean()}),
}

type FileTreeOverlayStatus = z.infer<typeof fileTreeOverlayStatusSchema>

export type ViewSettingsContext = z.infer<typeof viewSettingsContextSchema>

function overlayForViewport(status: FileTreeOverlayStatus, mobile: boolean): FileTreeOverlayStatus {
  if (!mobile) {
    return 'forced-closed'
  }
  return status === 'forced-closed' ? 'closed' : status
}

export const viewSettingsLogic = createStoreLogic({
  schemas: {context: viewSettingsContextSchema, events: viewSettingsEventSchemas},
  context: (): ViewSettingsContext => ({
    collapseMode: 'expanded',
    diffIndicators: 'bars',
    diffStyle: 'split',
    lineNumbers: true,
    overflow: 'scroll',
    showBackgrounds: true,
    status: 'closed',
  }),
  on: {
    collapseModeToggled: (context) => ({
      ...context,
      collapseMode: context.collapseMode === 'expanded' ? 'collapsed' : 'expanded',
    }),
    diffIndicatorsChanged: (context, {diffIndicators}) => ({...context, diffIndicators}),
    diffStyleChanged: (context, {diffStyle}) => ({...context, diffStyle}),
    lineNumbersChanged: (context, {lineNumbers}) => ({...context, lineNumbers}),
    overflowChanged: (context, {overflow}) => ({...context, overflow}),
    showBackgroundsChanged: (context, {showBackgrounds}) => ({...context, showBackgrounds}),
    fileTreeOverlayToggled: (context) => {
      if (context.status === 'forced-closed') {
        return undefined
      }
      return {...context, status: context.status === 'open' ? 'closed' : 'open'}
    },
    fileTreeOverlayClosed: (context) => {
      if (context.status !== 'open') {
        return undefined
      }
      return {...context, status: 'closed'}
    },
    viewportChanged: (context, {mobile}) => ({
      ...context,
      diffStyle: mobile ? 'unified' : 'split',
      status: overlayForViewport(context.status, mobile),
    }),
  },
})

export type ViewSettingsStore = StoreFromStoreLogicCreator<typeof viewSettingsLogic>
