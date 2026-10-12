import {z} from 'zod'

// Until billing exists, only these repositories get reviews.
const ALLOWED_REPOSITORIES = new Set(['davidjfelix/davidjfelix'])

// Adding this label to an open pull request starts a review of its head, also
// for drafts and for pull requests that the automatic reviews skip.
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
}

const pullRequestEventSchema = z.object({
  action: z.string(),
  installation: z.object({id: z.number()}),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    owner: z.object({login: z.string()}),
  }),
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
}

export async function handleReviewWebhook({
  request,
  secret,
  workflow,
}: HandleReviewWebhookParams): Promise<Response> {
  if (!secret || !workflow) {
    return Response.json({error: 'Reviews are not set up on this deployment'}, {status: 503})
  }
  const body = new Uint8Array(await request.arrayBuffer())
  const signature = request.headers.get('x-hub-signature-256')
  if (!(await verifyWebhookSignature({secret, body, signature}))) {
    return Response.json({error: 'The signature does not match the body'}, {status: 401})
  }
  const decision = decideReviewRun({
    event: request.headers.get('x-github-event'),
    payload: parseJson(body),
  })
  if (!decision.start) {
    return Response.json({status: 'ignored', reason: decision.reason}, {status: 202})
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
    return Response.json({status: 'duplicate'}, {status: 202})
  }
  return Response.json({status: 'started'}, {status: 202})
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
