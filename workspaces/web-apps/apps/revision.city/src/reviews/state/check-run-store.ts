import {createStoreLogic} from '@xstate/store'
import * as z from 'zod/mini'
import type {CheckRunOutput} from '../lib/review-markdown'

// A failed check run shows this button. A user who can push clicks it to pass
// the check without a new review (src/reviews/lib/dismiss-check-run.ts).
export const DISMISS_ACTION = {
  label: 'Dismiss findings',
  description: 'Pass this check without a new review',
  identifier: 'dismiss',
}

const RESOLVABLE_EXTERNAL_ID = 'resolvable-findings'
const DISMISSED_EXTERNAL_ID = 'dismissed'
const RESOLVED_TITLE_PREFIX = 'Resolved: '
const RESOLVED_SUMMARY_PREFIX =
  'Every current Revision City thread on this pull request is resolved, so this check passes. '
const DISMISSED_TITLE_PREFIX = 'Dismissed: '
const DISMISSED_SUMMARY_NOTE = ' dismissed the findings, so this check passes. '

const checkRunOutputSchema = z.custom<CheckRunOutput>()

// A `failed-resolvable` check run failed only on findings in threads of the
// app. It passes when `countOpenAppThreads` finds no open thread.
const checkRunOutcomeSchema = z.enum(['superseded', 'passed', 'failed', 'failed-resolvable'])

// No database table keeps the state of a review. GitHub keeps it on the check
// run, in its status, conclusion, external id, and output.
const checkRunContextSchema = z.readonly(
  z.discriminatedUnion('status', [
    z.object({status: z.literal('in-progress')}),
    z.object({
      status: z.enum([...checkRunOutcomeSchema.options, 'resolved']),
      reviewOutput: checkRunOutputSchema,
    }),
    z.object({
      status: z.literal('dismissed'),
      reviewOutput: checkRunOutputSchema,
      dismissedBy: z.string(),
    }),
  ]),
)

const checkRunEventSchemas = {
  completed: z.object({outcome: checkRunOutcomeSchema, output: checkRunOutputSchema}),
  threadsResolved: z.object({}),
  threadReopened: z.object({}),
  dismissed: z.object({by: z.string()}),
}

export type CheckRunOutcome = z.infer<typeof checkRunOutcomeSchema>

export type CheckRunState = z.infer<typeof checkRunContextSchema>

export interface GitHubCheckRun {
  status: string
  conclusion: string | null
  external_id: string | null
  output: {title: string | null; summary: string | null; text: string | null}
}

type Conclusion = 'success' | 'failure' | 'neutral'

// The fields that the app sends to create or update a check run.
export type CheckRunFields =
  | {status: 'in_progress'}
  | {
      status: 'completed'
      conclusion: Conclusion
      output: CheckRunOutput
      actions: (typeof DISMISS_ACTION)[]
      external_id?: string
    }

export const checkRunLogic = createStoreLogic({
  schemas: {context: checkRunContextSchema, events: checkRunEventSchemas},
  context: (state: CheckRunState) => state,
  on: {
    completed: (state, {outcome, output}): CheckRunState | undefined =>
      state.status === 'in-progress' ? {status: outcome, reviewOutput: output} : undefined,
    threadsResolved: (state): CheckRunState | undefined =>
      state.status === 'failed-resolvable'
        ? {status: 'resolved', reviewOutput: state.reviewOutput}
        : undefined,
    threadReopened: (state): CheckRunState | undefined =>
      state.status === 'resolved'
        ? {status: 'failed-resolvable', reviewOutput: state.reviewOutput}
        : undefined,
    dismissed: (state, {by}): CheckRunState | undefined =>
      state.status === 'failed' || state.status === 'failed-resolvable'
        ? {status: 'dismissed', reviewOutput: state.reviewOutput, dismissedBy: by}
        : undefined,
  },
})

export function decodeCheckRun({
  status,
  conclusion,
  external_id: externalId,
  output,
}: GitHubCheckRun): CheckRunState {
  if (status !== 'completed') {
    return {status: 'in-progress'}
  }
  const written: CheckRunOutput = {
    title: output.title ?? '',
    summary: output.summary ?? '',
    ...(output.text === null ? {} : {text: output.text}),
  }
  if (conclusion === 'failure') {
    const resolvable = externalId === RESOLVABLE_EXTERNAL_ID
    return {status: resolvable ? 'failed-resolvable' : 'failed', reviewOutput: written}
  }
  // Besides `success` and `failure`, the app writes only `neutral`. GitHub can
  // also set `stale`, and no event leaves a stale check run either.
  if (conclusion !== 'success') {
    return {status: 'superseded', reviewOutput: written}
  }
  if (externalId === RESOLVABLE_EXTERNAL_ID) {
    return {
      status: 'resolved',
      reviewOutput: {
        ...written,
        title: withoutPrefix(written.title, RESOLVED_TITLE_PREFIX),
        summary: withoutPrefix(written.summary, RESOLVED_SUMMARY_PREFIX),
      },
    }
  }
  if (externalId === DISMISSED_EXTERNAL_ID) {
    const [dismissedBy, ...summary] = written.summary.split(DISMISSED_SUMMARY_NOTE)
    return {
      status: 'dismissed',
      reviewOutput: {
        ...written,
        title: withoutPrefix(written.title, DISMISSED_TITLE_PREFIX),
        summary: summary.join(DISMISSED_SUMMARY_NOTE),
      },
      dismissedBy,
    }
  }
  return {status: 'passed', reviewOutput: written}
}

const OUTCOME_CONCLUSIONS = {
  superseded: 'neutral',
  passed: 'success',
  failed: 'failure',
  'failed-resolvable': 'failure',
} satisfies Record<CheckRunOutcome, Conclusion>

export function encodeCheckRun(state: CheckRunState): CheckRunFields {
  if (state.status === 'in-progress') {
    return {status: 'in_progress'}
  }
  if (state.status === 'resolved') {
    return completedFields({
      conclusion: 'success',
      output: withPrefixes(state.reviewOutput, {
        title: RESOLVED_TITLE_PREFIX,
        summary: RESOLVED_SUMMARY_PREFIX,
      }),
      externalId: RESOLVABLE_EXTERNAL_ID,
    })
  }
  if (state.status === 'dismissed') {
    return completedFields({
      conclusion: 'success',
      // A login has only letters, digits, and hyphens, so it cannot add a
      // mention or markup.
      output: withPrefixes(state.reviewOutput, {
        title: DISMISSED_TITLE_PREFIX,
        summary: `${state.dismissedBy}${DISMISSED_SUMMARY_NOTE}`,
      }),
      externalId: DISMISSED_EXTERNAL_ID,
    })
  }
  return completedFields({
    conclusion: OUTCOME_CONCLUSIONS[state.status],
    output: state.reviewOutput,
    ...(state.status === 'failed-resolvable' ? {externalId: RESOLVABLE_EXTERNAL_ID} : {}),
  })
}

interface CompletedFieldsParams {
  conclusion: Conclusion
  output: CheckRunOutput
  externalId?: string
}

function completedFields({conclusion, output, externalId}: CompletedFieldsParams): CheckRunFields {
  return {
    status: 'completed',
    conclusion,
    output,
    // An empty list removes the button from a check run that did not fail.
    actions: conclusion === 'failure' ? [DISMISS_ACTION] : [],
    ...(externalId === undefined ? {} : {external_id: externalId}),
  }
}

interface Prefixes {
  title: string
  summary: string
}

function withPrefixes(output: CheckRunOutput, prefixes: Prefixes): CheckRunOutput {
  return {
    ...output,
    title: `${prefixes.title}${output.title}`,
    summary: `${prefixes.summary}${output.summary}`,
  }
}

function withoutPrefix(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length) : text
}
