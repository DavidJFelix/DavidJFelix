// cSpell:ignore rerequested -- the GitHub action of a Re-run click

import {z} from 'zod'
import type {DismissResult} from './dismiss-check-run'
import {APP_BOT_LOGIN, APP_SLUG, DISMISS_ACTION} from './publish-review'
import type {SyncResult} from './resolved-threads'
import {type LogWideEvent, logWideEvent} from './wide-event'

// Until billing exists, only these repositories get reviews.
const ALLOWED_REPOSITORIES = new Set(['davidjfelix/davidjfelix'])

// When a maintainer adds this label to an open pull request, a review of its
// head starts. This also works for drafts and for pull requests that the
// automatic reviews skip. The review removes the label, so that a maintainer
// can add it again to start another review.
export const REVIEW_LABEL = 'Revision City'

const AUTOMATIC_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review'])

// Each review costs money, so automatic reviews are only for authors with
// access to the repository. For other authors, a maintainer adds the label.
const TRUSTED_AUTHOR_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

export interface ReviewRunParams {
  installationId: number
  repositoryId: number
  owner: string
  name: string
  pullNumber: number
  headSha: string
  // The label as the pull request shows it, when the label started the review.
  label?: string
  // True when a user asked to run the check again (`decideRerun`).
  rerun?: boolean
}

const repositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({login: z.string()}),
})

const pullRequestEventSchema = z.object({
  action: z.string(),
  installation: z.object({id: z.number()}),
  repository: repositorySchema,
  pull_request: z.object({
    number: z.number(),
    state: z.string(),
    draft: z.boolean(),
    updated_at: z.iso.datetime(),
    author_association: z.string(),
    user: z.object({type: z.string()}),
    head: z.object({sha: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/)}),
  }),
  label: z.object({name: z.string()}).optional(),
})

export type ReviewRunDecision =
  | {start: false; reason: string}
  | {start: true; instanceId: string; params: ReviewRunParams}

export interface DecideReviewRunParams {
  // The X-GitHub-Event header.
  event: string | null
  payload: unknown
}

export function decideReviewRun({event, payload}: DecideReviewRunParams): ReviewRunDecision {
  if (event !== 'pull_request') {
    return {start: false, reason: `${event} events are not reviewed`}
  }
  const parsed = pullRequestEventSchema.safeParse(payload)
  if (!parsed.success) {
    return {start: false, reason: 'The payload is not a pull request event'}
  }
  const {action, installation, repository, pull_request: pull, label} = parsed.data
  if (!ALLOWED_REPOSITORIES.has(repository.full_name.toLowerCase())) {
    return {start: false, reason: `${repository.full_name} is not allowed`}
  }
  if (pull.state !== 'open') {
    return {start: false, reason: 'The pull request is closed'}
  }
  const reviewLabel =
    action === 'labeled' && label?.name.toLowerCase() === REVIEW_LABEL.toLowerCase()
      ? label.name
      : undefined
  const skipReason = reviewLabel === undefined ? automaticSkipReason(action, pull) : undefined
  if (skipReason !== undefined) {
    return {start: false, reason: skipReason}
  }
  const pullId = `${repository.id}-${pull.number}`
  const updatedAt = pull.updated_at.replaceAll(/[^0-9TZ]/g, '')
  return {
    start: true,
    // An instance id stays taken after its instance ends. With the update time,
    // each new event gets a new id, and a repeated delivery of one event does
    // not start a second review.
    instanceId:
      reviewLabel === undefined
        ? `${pullId}-${pull.head.sha}-${updatedAt}`
        : `${pullId}-label-${updatedAt}`,
    params: {
      installationId: installation.id,
      repositoryId: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      pullNumber: pull.number,
      headSha: pull.head.sha,
      ...(reviewLabel === undefined ? {} : {label: reviewLabel}),
    },
  }
}

// The part of a check run or a check suite that a rerun reads.
const rerunCheckSchema = z.object({
  id: z.number(),
  head_sha: z.string(),
  app: z.object({slug: z.string()}).nullable(),
  pull_requests: z.array(
    z.object({number: z.number(), base: z.object({repo: z.object({id: z.number()})})}),
  ),
})

const rerunEventSchema = z.object({
  action: z.string(),
  installation: z.object({id: z.number()}),
  repository: repositorySchema,
  check_run: rerunCheckSchema.optional(),
  check_suite: rerunCheckSchema.optional(),
})

export interface DecideRerunParams extends DecideReviewRunParams {
  // The X-GitHub-Event header.
  event: 'check_run' | 'check_suite'
  // The X-GitHub-Delivery header. A delivery that GitHub sends again keeps it.
  deliveryId: string | null
}

// A click on Re-run (check run) or Re-run all checks (check suite). As with the
// label, the review takes the current head of the pull request, because the
// check can be on an older commit. Only users who can push see the buttons.
export function decideRerun({event, payload, deliveryId}: DecideRerunParams): ReviewRunDecision {
  const parsed = rerunEventSchema.safeParse(payload)
  const check = event === 'check_run' ? parsed.data?.check_run : parsed.data?.check_suite
  if (!parsed.success || check === undefined) {
    return {start: false, reason: `The payload is not a ${event} event`}
  }
  const {action, installation, repository} = parsed.data
  if (!ALLOWED_REPOSITORIES.has(repository.full_name.toLowerCase())) {
    return {start: false, reason: `${repository.full_name} is not allowed`}
  }
  if (action !== 'rerequested' || check.app?.slug !== APP_SLUG) {
    return {start: false, reason: 'The event does not ask to run a check of the app again'}
  }
  // A commit can be the head of more than one pull request. The review is for
  // the first one in this repository. GitHub lists no pull requests from forks.
  const pull = check.pull_requests.find((entry) => entry.base.repo.id === repository.id)
  if (pull === undefined) {
    return {start: false, reason: 'The check has no pull request in this repository'}
  }
  const once = deliveryId?.replaceAll(/[^0-9a-f-]/gi, '') || `${event}-${check.id}`
  return {
    start: true,
    instanceId: `${repository.id}-${pull.number}-rerun-${once}`,
    params: {
      installationId: installation.id,
      repositoryId: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      pullNumber: pull.number,
      // The commit of the check. The review takes the current head instead.
      headSha: check.head_sha,
      rerun: true,
    },
  }
}

// The pull request whose check run must agree with its threads again.
export interface ThreadSyncParams {
  installationId: number
  repositoryId: number
  owner: string
  name: string
  pullNumber: number
}

export type ThreadSyncDecision =
  | {sync: false; reason: string}
  | {sync: true; params: ThreadSyncParams}

const reviewThreadEventSchema = z.object({
  action: z.string(),
  installation: z.object({id: z.number()}),
  repository: repositorySchema,
  pull_request: z.object({number: z.number()}),
  thread: z.object({
    comments: z.array(z.object({user: z.object({login: z.string()}).nullable()})),
  }),
})

const THREAD_ACTIONS = new Set(['resolved', 'unresolved'])

// Resolving or opening again a thread that the app started can change the
// result of the check run (src/reviews/lib/resolved-threads.ts).
export function decideThreadSync({event, payload}: DecideReviewRunParams): ThreadSyncDecision {
  const parsed = reviewThreadEventSchema.safeParse(payload)
  if (event !== 'pull_request_review_thread' || !parsed.success) {
    return {sync: false, reason: 'The payload is not a review thread event'}
  }
  const {action, installation, repository, pull_request: pull, thread} = parsed.data
  if (!ALLOWED_REPOSITORIES.has(repository.full_name.toLowerCase())) {
    return {sync: false, reason: `${repository.full_name} is not allowed`}
  }
  if (!THREAD_ACTIONS.has(action)) {
    return {sync: false, reason: `The ${action} action does not change the check`}
  }
  if (thread.comments[0]?.user?.login !== APP_BOT_LOGIN) {
    return {sync: false, reason: 'The app did not start the thread'}
  }
  return {
    sync: true,
    params: {
      installationId: installation.id,
      repositoryId: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      pullNumber: pull.number,
    },
  }
}

// The check run that a user asked to dismiss.
export interface DismissParams {
  installationId: number
  repositoryId: number
  owner: string
  name: string
  checkRunId: number
  login: string
}

export type DismissDecision =
  | {dismiss: false; reason: string}
  | {dismiss: true; params: DismissParams}

const checkRunEventSchema = z.object({
  action: z.string(),
  installation: z.object({id: z.number()}),
  repository: repositorySchema,
  check_run: z.object({id: z.number(), app: z.object({slug: z.string()}).nullable()}),
  requested_action: z.object({identifier: z.string()}).optional(),
  sender: z.object({login: z.string()}),
})

// A click on the button of a failed check run (`DISMISS_ACTION`).
export function decideDismiss({event, payload}: DecideReviewRunParams): DismissDecision {
  const parsed = checkRunEventSchema.safeParse(payload)
  if (event !== 'check_run' || !parsed.success) {
    return {dismiss: false, reason: 'The payload is not a check run event'}
  }
  const {
    action,
    installation,
    repository,
    check_run: checkRun,
    requested_action: requested,
    sender,
  } = parsed.data
  if (!ALLOWED_REPOSITORIES.has(repository.full_name.toLowerCase())) {
    return {dismiss: false, reason: `${repository.full_name} is not allowed`}
  }
  if (
    action !== 'requested_action' ||
    requested?.identifier !== DISMISS_ACTION.identifier ||
    checkRun.app?.slug !== APP_SLUG
  ) {
    return {dismiss: false, reason: 'The event does not ask to dismiss a check run of the app'}
  }
  return {
    dismiss: true,
    params: {
      installationId: installation.id,
      repositoryId: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      checkRunId: checkRun.id,
      login: sender.login,
    },
  }
}

type EventPullRequest = z.infer<typeof pullRequestEventSchema>['pull_request']

function automaticSkipReason(action: string, pull: EventPullRequest): string | undefined {
  if (!AUTOMATIC_ACTIONS.has(action)) {
    return `The ${action} action does not start a review`
  }
  if (pull.draft) {
    return 'The pull request is a draft'
  }
  if (pull.user.type === 'Bot') {
    return 'A bot opened the pull request'
  }
  if (!TRUSTED_AUTHOR_ASSOCIATIONS.has(pull.author_association)) {
    return 'The author has no access to the repository'
  }
  return undefined
}

// The part of a Workflow binding that starts reviews.
export interface ReviewWorkflowBinding {
  create(options: {id: string; params: ReviewRunParams}): Promise<unknown>
  get(id: string): Promise<unknown>
}

export interface HandleReviewWebhookParams {
  request: Request
  // Both are absent on deployments without reviews, such as previews.
  secret: string | undefined
  workflow: ReviewWorkflowBinding | undefined
  // Both are absent on deployments without the app's client id or private key.
  syncCheckRun?: (params: ThreadSyncParams) => Promise<SyncResult>
  dismissCheckRun?: (params: DismissParams) => Promise<DismissResult>
  log?: LogWideEvent
}

// Logs one event for each delivery with a valid signature. The 503 and 401
// answers log nothing: anyone can send a request to the route, and the Workers
// invocation log keeps the status code.
export async function handleReviewWebhook({
  request,
  secret,
  workflow,
  syncCheckRun,
  dismissCheckRun,
  log = logWideEvent,
}: HandleReviewWebhookParams): Promise<Response> {
  if (!secret || !workflow) {
    return Response.json({error: 'Reviews are not set up on this deployment'}, {status: 503})
  }
  const body = new Uint8Array(await request.arrayBuffer())
  const signature = request.headers.get('x-hub-signature-256')
  if (!(await verifyWebhookSignature({secret, body, signature}))) {
    return Response.json({error: 'The signature does not match the body'}, {status: 401})
  }
  const event = request.headers.get('x-github-event')
  const payload = parseJson(body)
  const deliveryId = request.headers.get('x-github-delivery')
  const deliveryFields = {
    event: 'webhook delivery',
    deliveryId: deliveryId ?? undefined,
    githubEvent: event ?? undefined,
    action: readAction(payload),
  }
  try {
    const delivery = await handleDelivery({
      event,
      deliveryId,
      payload,
      workflow,
      syncCheckRun,
      dismissCheckRun,
    })
    log({
      ...deliveryFields,
      decision: delivery.answer.status,
      reason: delivery.answer.reason,
      runId: delivery.runId,
    })
    return Response.json(delivery.answer, {status: delivery.httpStatus})
  } catch (error) {
    log({...deliveryFields, decision: 'error', error: String(error)})
    throw error
  }
}

interface HandleDeliveryParams {
  event: string | null
  deliveryId: string | null
  payload: unknown
  workflow: ReviewWorkflowBinding
  syncCheckRun: HandleReviewWebhookParams['syncCheckRun']
  dismissCheckRun: HandleReviewWebhookParams['dismissCheckRun']
}

interface Delivery {
  httpStatus: 200 | 202
  answer: {status: string; reason?: string}
  // The Workflow instance id of the review, when the delivery started one.
  runId?: string
}

async function handleDelivery({
  event,
  deliveryId,
  payload,
  workflow,
  syncCheckRun,
  dismissCheckRun,
}: HandleDeliveryParams): Promise<Delivery> {
  if (event === 'pull_request_review_thread') {
    const sync = decideThreadSync({event, payload})
    if (!sync.sync || !syncCheckRun) {
      const reason = sync.sync ? 'Threads are not set up on this deployment' : sync.reason
      return {httpStatus: 202, answer: {status: 'ignored', reason}}
    }
    return {httpStatus: 200, answer: {status: await syncCheckRun(sync.params)}}
  }
  if ((event === 'check_run' || event === 'check_suite') && readAction(payload) === 'rerequested') {
    return startReview({workflow, decision: decideRerun({event, payload, deliveryId})})
  }
  if (event === 'check_run') {
    const dismiss = decideDismiss({event, payload})
    if (!dismiss.dismiss || !dismissCheckRun) {
      const reason = dismiss.dismiss
        ? 'Dismissing is not set up on this deployment'
        : dismiss.reason
      return {httpStatus: 202, answer: {status: 'ignored', reason}}
    }
    return {httpStatus: 200, answer: {status: await dismissCheckRun(dismiss.params)}}
  }
  return startReview({workflow, decision: decideReviewRun({event, payload})})
}

interface StartReviewParams {
  workflow: ReviewWorkflowBinding
  decision: ReviewRunDecision
}

async function startReview({workflow, decision}: StartReviewParams): Promise<Delivery> {
  if (!decision.start) {
    return {httpStatus: 202, answer: {status: 'ignored', reason: decision.reason}}
  }
  try {
    await workflow.create({id: decision.instanceId, params: decision.params})
  } catch (error) {
    // Creating an instance fails when one with the same id exists, for example
    // when GitHub delivers an event again.
    const exists = await workflow.get(decision.instanceId).then(
      () => true,
      () => false,
    )
    if (!exists) {
      throw error
    }
    return {httpStatus: 202, answer: {status: 'duplicate'}, runId: decision.instanceId}
  }
  return {httpStatus: 202, answer: {status: 'started'}, runId: decision.instanceId}
}

function readAction(payload: unknown): string | undefined {
  const parsed = z.object({action: z.string()}).safeParse(payload)
  return parsed.success ? parsed.data.action : undefined
}

interface VerifyWebhookSignatureParams {
  secret: string
  body: Uint8Array<ArrayBuffer>
  // The X-Hub-Signature-256 header: "sha256=" and the hex HMAC of the body.
  signature: string | null
}

async function verifyWebhookSignature({
  secret,
  body,
  signature,
}: VerifyWebhookSignatureParams): Promise<boolean> {
  const hex = /^sha256=([0-9a-f]{64})$/.exec(signature ?? '')?.[1]
  if (hex === undefined) {
    return false
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['verify'],
  )
  const expected = Uint8Array.from({length: hex.length / 2}, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  )
  // WebCrypto compares in constant time.
  return crypto.subtle.verify('HMAC', key, expected, body)
}

function parseJson(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(body))
  } catch {
    return undefined
  }
}
