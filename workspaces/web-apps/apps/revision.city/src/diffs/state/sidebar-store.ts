import type {GitStatus} from '@pierre/trees'
import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'

const gitStatusSchema = z.custom<GitStatus>()

const sidebarTabSchema = z.enum(['files', 'comments', 'symbols'])

const sidebarStatusPanelSchema = z.enum(['diffStats', 'systemMonitor'])

const sidebarShape = {
  selectedStatusPanel: z.nullable(sidebarStatusPanelSchema),
  // The Git statuses that the file tree shows. An empty set shows all files.
  selectedStatuses: z.readonly(z.set(gitStatusSchema)),
}

// The symbol reads start only after the first open of the Symbols tab. The status does not return
// to `symbolsUnopened`, so the results stay when the visitor opens a different tab.
const sidebarContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({
      ...sidebarShape,
      activeTab: z.enum(['files', 'comments']),
      status: z.literal('symbolsUnopened'),
    }),
    z.object({...sidebarShape, activeTab: sidebarTabSchema, status: z.literal('symbolsOpened')}),
  ]),
)

const sidebarEventSchemas = {
  tabOpened: z.object({tab: sidebarTabSchema}),
  statusPanelToggled: z.object({panel: sidebarStatusPanelSchema}),
  statusToggled: z.object({gitStatus: gitStatusSchema}),
  statusIsolated: z.object({gitStatus: gitStatusSchema}),
  statusFilterCleared: z.object({}),
}

export type SidebarTab = z.infer<typeof sidebarTabSchema>

export type SidebarContext = z.infer<typeof sidebarContextSchema>

export const sidebarLogic = createStoreLogic({
  schemas: {context: sidebarContextSchema, events: sidebarEventSchemas},
  context: (): SidebarContext => ({
    activeTab: 'files',
    selectedStatusPanel: 'diffStats',
    selectedStatuses: new Set(),
    status: 'symbolsUnopened',
  }),
  on: {
    tabOpened: (context, {tab}): SidebarContext | undefined => {
      if (tab === context.activeTab) {
        return undefined
      }
      return tab === 'symbols' || context.status === 'symbolsOpened'
        ? {...context, activeTab: tab, status: 'symbolsOpened'}
        : {...context, activeTab: tab}
    },
    statusPanelToggled: (context, {panel}): SidebarContext => ({
      ...context,
      selectedStatusPanel: context.selectedStatusPanel === panel ? null : panel,
    }),
    statusToggled: (context, {gitStatus}): SidebarContext => {
      const selectedStatuses = new Set(context.selectedStatuses)
      if (selectedStatuses.has(gitStatus)) {
        selectedStatuses.delete(gitStatus)
      } else {
        selectedStatuses.add(gitStatus)
      }
      return {...context, selectedStatuses}
    },
    statusIsolated: (context, {gitStatus}): SidebarContext => {
      const isolated =
        context.selectedStatuses.size === 1 && context.selectedStatuses.has(gitStatus)
      return {...context, selectedStatuses: new Set(isolated ? [] : [gitStatus])}
    },
    statusFilterCleared: (context): SidebarContext | undefined =>
      context.selectedStatuses.size === 0 ? undefined : {...context, selectedStatuses: new Set()},
  },
})
