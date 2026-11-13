// cSpell:ignore revisioncity rerequested -- the GitHub App's slug, the action of a Re-run click

import {createHmac} from 'node:crypto'
import {expect, test, vi} from 'vitest'
import {
  decideDismiss,
  decideRerun,
  decideReviewRun,
  decideThreadSync,
  type HandleReviewWebhookParams,
  handleReviewWebhook,
  type ReviewWorkflowBinding,
} from './webhook'
import type {LogWideEvent} from './wide-event'

const secret = 'webhook-secret'
const deliveryId = '72d3162e-cc78-11e3-81ab-4c9367dc0958'
const headSha = 'e39a9f6002585daebc8265b3d94e094471f4a3d9'

const pullRequestEvent = {
  action: 'opened',
  installation: {id: 5},
  repository: {
    id: 9,
    name: 'DavidJFelix',
    full_name: 'DavidJFelix/DavidJFelix',
    owner: {login: 'DavidJFelix'},
  },
  pull_request: {
    number: 769,
    state: 'open',
    draft: false,
    updated_at: '2026-10-12T12:53:35Z',
    author_association: 'OWNER',
    user: {type: 'User'},
    head: {sha: headSha},
  },
}

const withPullRequest = (changes: object, event: object = {}): object => ({
  ...pullRequestEvent,
  ...event,
  pull_request: {...pullRequestEvent.pull_request, ...changes},
})

const labeled = (name: string, changes: object = {}): object =>
  withPullRequest(changes, {action: 'labeled', label: {name}})

const sign = (body: string): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

interface WebhookRequestParams {
  payload: object
  event?: string
  signature?: string
  omitSignature?: boolean
}

function webhookRequest({
  payload,
  event = 'pull_request',
  signature,
  omitSignature = false,
}: WebhookRequestParams) {
  const body = JSON.stringify(payload)
  const headers = new Headers({'x-github-event': event, 'x-github-delivery': deliveryId})
  if (!omitSignature) {
    headers.set('x-hub-signature-256', signature ?? sign(body))
  }
  return new Request('https://revision.city/api/github/webhook', {method: 'POST', headers, body})
}

const fakeWorkflow = (): ReviewWorkflowBinding & {
  create: ReturnType<typeof vi.fn<ReviewWorkflowBinding['create']>>
} => ({
  create: vi.fn<ReviewWorkflowBinding['create']>(async () => ({})),
  get: vi.fn<ReviewWorkflowBinding['get']>(async () => {
    throw new Error('instance.not_found')
  }),
})

const fakeLog = () => vi.fn<LogWideEvent>()

const deliveryEvent = (fields: object): object => ({
  event: 'webhook delivery',
  deliveryId,
  githubEvent: 'pull_request',
  action: 'opened',
  reason: undefined,
  runId: undefined,
  ...fields,
})

test('handleReviewWebhook starts a review of the head and answers 202', async () => {
  const workflow = fakeWorkflow()
  const log = fakeLog()

  const response = await handleReviewWebhook({
    request: webhookRequest({payload: pullRequestEvent}),
    secret,
    workflow,
    log,
  })

  expect(response.status).toBe(202)
  expect(await response.json()).toEqual({status: 'started'})
  expect(workflow.create).toHaveBeenCalledWith({
    id: `9-769-${headSha}-20261012T125335Z`,
    params: {
      installationId: 5,
      repositoryId: 9,
      owner: 'DavidJFelix',
      name: 'DavidJFelix',
      pullNumber: 769,
      headSha,
    },
  })
  expect(log.mock.calls).toEqual([
    [deliveryEvent({decision: 'started', runId: `9-769-${headSha}-20261012T125335Z`})],
  ])
})

test.each([
  {name: 'the secret', setup: {secret: undefined, workflow: fakeWorkflow()}},
  {name: 'the Workflow binding', setup: {secret, workflow: undefined}},
])('handleReviewWebhook answers 503 without $name', async ({setup}) => {
  const response = await handleReviewWebhook({
    request: webhookRequest({payload: pullRequestEvent}),
    ...setup,
  })

  expect(response.status).toBe(503)
})

test.each([
  {name: 'is missing', omitSignature: true},
  {name: 'is empty', signature: ''},
  {name: 'has another format', signature: 'sha1=0123456789abcdef'},
  {name: 'signs another body', signature: sign('{}')},
])(
  'handleReviewWebhook answers 401 when the signature $name',
  async ({signature, omitSignature}) => {
    const workflow = fakeWorkflow()
    const log = fakeLog()

    const response = await handleReviewWebhook({
      request: webhookRequest({payload: pullRequestEvent, signature, omitSignature}),
      secret,
      workflow,
      log,
    })

    expect(response.status).toBe(401)
    expect(workflow.create).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  },
)

test('handleReviewWebhook ignores a signed body that is not JSON', async () => {
  const request = new Request('https://revision.city/api/github/webhook', {
    method: 'POST',
    headers: {'x-github-event': 'pull_request', 'x-hub-signature-256': sign('not json')},
    body: 'not json',
  })

  const log = fakeLog()

  const response = await handleReviewWebhook({request, secret, workflow: fakeWorkflow(), log})

  expect(response.status).toBe(202)
  expect(await response.json()).toEqual({
    status: 'ignored',
    reason: 'The payload is not a pull request event',
  })
  expect(log.mock.calls).toEqual([
    [
      deliveryEvent({
        deliveryId: undefined,
        action: undefined,
        decision: 'ignored',
        reason: 'The payload is not a pull request event',
      }),
    ],
  ])
})

test('handleReviewWebhook answers duplicate when the instance already exists', async () => {
  const workflow = fakeWorkflow()
  workflow.create.mockRejectedValue(new Error('instance.already_exists'))
  workflow.get = async () => ({})
  const log = fakeLog()

  const response = await handleReviewWebhook({
    request: webhookRequest({payload: pullRequestEvent}),
    secret,
    workflow,
    log,
  })

  expect(response.status).toBe(202)
  expect(await response.json()).toEqual({status: 'duplicate'})
  expect(log.mock.calls).toEqual([
    [deliveryEvent({decision: 'duplicate', runId: `9-769-${headSha}-20261012T125335Z`})],
  ])
})

test('handleReviewWebhook throws when the instance cannot start', async () => {
  const workflow = fakeWorkflow()
  workflow.create.mockRejectedValue(new Error('workflow unavailable'))
  const log = fakeLog()

  await expect(
    handleReviewWebhook({
      request: webhookRequest({payload: pullRequestEvent}),
      secret,
      workflow,
      log,
    }),
  ).rejects.toThrow('workflow unavailable')
  expect(log.mock.calls).toEqual([
    [
      {
        event: 'webhook delivery',
        deliveryId,
        githubEvent: 'pull_request',
        action: 'opened',
        decision: 'error',
        error: 'Error: workflow unavailable',
      },
    ],
  ])
})

test.each([
  {name: 'a ping', event: 'ping', payload: {}, reason: 'ping events are not reviewed'},
  {
    name: 'a payload without an installation',
    payload: {...pullRequestEvent, installation: undefined},
    reason: 'The payload is not a pull request event',
  },
  {
    name: 'a head that is not a commit id',
    payload: withPullRequest({head: {sha: 'main'}}),
    reason: 'The payload is not a pull request event',
  },
  {
    name: 'a repository outside the allowlist',
    payload: {...pullRequestEvent, repository: {...pullRequestEvent.repository, full_name: 'a/b'}},
    reason: 'a/b is not allowed',
  },
  {
    name: 'a closed pull request',
    payload: withPullRequest({state: 'closed'}),
    reason: 'The pull request is closed',
  },
  {
    name: 'a closed pull request with the label',
    payload: labeled('Revision City', {state: 'closed'}),
    reason: 'The pull request is closed',
  },
  {
    name: 'an edit',
    payload: withPullRequest({}, {action: 'edited'}),
    reason: 'The edited action does not start a review',
  },
  {
    name: 'another label',
    payload: labeled('bug'),
    reason: 'The labeled action does not start a review',
  },
  {
    name: 'a draft',
    payload: withPullRequest({draft: true}),
    reason: 'The pull request is a draft',
  },
  {
    name: 'a pull request that a bot opened',
    payload: withPullRequest({user: {type: 'Bot'}}),
    reason: 'A bot opened the pull request',
  },
  {
    name: 'an author without access',
    payload: withPullRequest({author_association: 'CONTRIBUTOR'}),
    reason: 'The author has no access to the repository',
  },
])('decideReviewRun ignores $name', ({event = 'pull_request', payload, reason}) => {
  expect(decideReviewRun({event, payload})).toEqual({start: false, reason})
})

test.each(['opened', 'synchronize', 'reopened', 'ready_for_review'])(
  'decideReviewRun starts a review when a pull request is %s',
  (action) => {
    expect(
      decideReviewRun({event: 'pull_request', payload: withPullRequest({}, {action})}),
    ).toMatchObject({start: true, instanceId: `9-769-${headSha}-20261012T125335Z`})
  },
)

test('decideReviewRun starts a review for the label, also on a draft that a bot opened', () => {
  const payload = labeled('revision city', {
    draft: true,
    user: {type: 'Bot'},
    author_association: 'NONE',
  })

  expect(decideReviewRun({event: 'pull_request', payload})).toEqual({
    start: true,
    instanceId: '9-769-label-20261012T125335Z',
    params: {
      installationId: 5,
      repositoryId: 9,
      owner: 'DavidJFelix',
      name: 'DavidJFelix',
      pullNumber: 769,
      headSha,
      label: 'revision city',
    },
  })
})

const threadEvent = {
  action: 'resolved',
  installation: {id: 5},
  repository: pullRequestEvent.repository,
  pull_request: {number: 769},
  thread: {comments: [{user: {login: 'revisioncity[bot]'}}, {user: {login: 'DavidJFelix'}}]},
}

test('handleReviewWebhook syncs the check run when a thread of the app is resolved', async () => {
  const workflow = fakeWorkflow()
  const syncCheckRun = vi.fn<NonNullable<HandleReviewWebhookParams['syncCheckRun']>>(
    async () => 'resolved',
  )
  const log = fakeLog()

  const response = await handleReviewWebhook({
    request: webhookRequest({payload: threadEvent, event: 'pull_request_review_thread'}),
    secret,
    workflow,
    syncCheckRun,
    log,
  })

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({status: 'resolved'})
  expect(syncCheckRun).toHaveBeenCalledWith({
    installationId: 5,
    repositoryId: 9,
    owner: 'DavidJFelix',
    name: 'DavidJFelix',
    pullNumber: 769,
  })
  expect(workflow.create).not.toHaveBeenCalled()
  expect(log.mock.calls).toEqual([
    [
      deliveryEvent({
        githubEvent: 'pull_request_review_thread',
        action: 'resolved',
        decision: 'resolved',
      }),
    ],
  ])
})

test('handleReviewWebhook ignores a thread event on a deployment without the app key', async () => {
  const response = await handleReviewWebhook({
    request: webhookRequest({payload: threadEvent, event: 'pull_request_review_thread'}),
    secret,
    workflow: fakeWorkflow(),
  })

  expect(response.status).toBe(202)
  expect(await response.json()).toMatchObject({status: 'ignored'})
})

test('handleReviewWebhook ignores a thread that the app did not start', async () => {
  const syncCheckRun = vi.fn<NonNullable<HandleReviewWebhookParams['syncCheckRun']>>(
    async () => 'resolved',
  )

  const response = await handleReviewWebhook({
    request: webhookRequest({
      payload: {...threadEvent, thread: {comments: [{user: {login: 'DavidJFelix'}}]}},
      event: 'pull_request_review_thread',
    }),
    secret,
    workflow: fakeWorkflow(),
    syncCheckRun,
  })

  expect(await response.json()).toEqual({
    status: 'ignored',
    reason: 'The app did not start the thread',
  })
  expect(syncCheckRun).not.toHaveBeenCalled()
})

test('decideThreadSync syncs on an unresolved thread of the app', () => {
  expect(
    decideThreadSync({
      event: 'pull_request_review_thread',
      payload: {...threadEvent, action: 'unresolved'},
    }),
  ).toMatchObject({sync: true})
})

test.each([
  {name: 'another event', event: 'pull_request', payload: threadEvent},
  {name: 'another action', payload: {...threadEvent, action: 'created'}},
  {
    name: 'a thread that someone else started',
    payload: {...threadEvent, thread: {comments: [{user: {login: 'DavidJFelix'}}]}},
  },
  {
    name: 'a repository that is not allowed',
    payload: {...threadEvent, repository: {...threadEvent.repository, full_name: 'acme/repo'}},
  },
  {name: 'a payload of another shape', payload: {action: 'resolved'}},
])('decideThreadSync ignores $name', ({event = 'pull_request_review_thread', payload}) => {
  expect(decideThreadSync({event, payload})).toMatchObject({sync: false})
})

const checkRunEvent = {
  action: 'requested_action',
  installation: {id: 5},
  repository: pullRequestEvent.repository,
  check_run: {id: 31, app: {slug: 'revisioncity'}},
  requested_action: {identifier: 'dismiss'},
  sender: {login: 'DavidJFelix'},
}

test('handleReviewWebhook dismisses the check run when its button is clicked', async () => {
  const dismissCheckRun = vi.fn<NonNullable<HandleReviewWebhookParams['dismissCheckRun']>>(
    async () => 'dismissed',
  )
  const log = fakeLog()

  const response = await handleReviewWebhook({
    request: webhookRequest({payload: checkRunEvent, event: 'check_run'}),
    secret,
    workflow: fakeWorkflow(),
    dismissCheckRun,
    log,
  })

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({status: 'dismissed'})
  expect(dismissCheckRun).toHaveBeenCalledWith({
    installationId: 5,
    repositoryId: 9,
    owner: 'DavidJFelix',
    name: 'DavidJFelix',
    checkRunId: 31,
    login: 'DavidJFelix',
  })
  expect(log.mock.calls).toEqual([
    [deliveryEvent({githubEvent: 'check_run', action: 'requested_action', decision: 'dismissed'})],
  ])
})

test.each([
  {name: 'without the app key', payload: checkRunEvent, withDismiss: false},
  {name: 'for another check run action', payload: {...checkRunEvent, action: 'completed'}},
])('handleReviewWebhook ignores a check run event $name', async ({payload, withDismiss = true}) => {
  const dismissCheckRun = vi.fn<NonNullable<HandleReviewWebhookParams['dismissCheckRun']>>(
    async () => 'dismissed',
  )

  const response = await handleReviewWebhook({
    request: webhookRequest({payload, event: 'check_run'}),
    secret,
    workflow: fakeWorkflow(),
    ...(withDismiss ? {dismissCheckRun} : {}),
  })

  expect(response.status).toBe(202)
  expect(await response.json()).toMatchObject({status: 'ignored'})
  expect(dismissCheckRun).not.toHaveBeenCalled()
})

test.each([
  {name: 'another event', event: 'check_suite', payload: checkRunEvent},
  {name: 'another button', payload: {...checkRunEvent, requested_action: {identifier: 'other'}}},
  {name: 'no button', payload: {...checkRunEvent, requested_action: undefined}},
  {
    name: 'a check run of another app',
    payload: {...checkRunEvent, check_run: {id: 31, app: {slug: 'other-app'}}},
  },
  {
    name: 'a repository that is not allowed',
    payload: {...checkRunEvent, repository: {...checkRunEvent.repository, full_name: 'acme/repo'}},
  },
  {name: 'a payload of another shape', payload: {action: 'requested_action'}},
])('decideDismiss ignores $name', ({event = 'check_run', payload}) => {
  expect(decideDismiss({event, payload})).toMatchObject({dismiss: false})
})

const oldSha = '0000000000000000000000000000000000000001'

const rerunCheck = {
  id: 31,
  head_sha: oldSha,
  app: {slug: 'revisioncity'},
  pull_requests: [{number: 769, base: {repo: {id: 9}}}],
}

const rerunEvent = (key: 'check_run' | 'check_suite', changes: object = {}): object => ({
  action: 'rerequested',
  installation: {id: 5},
  repository: pullRequestEvent.repository,
  [key]: {...rerunCheck, ...changes},
})

const rerunParams = {
  installationId: 5,
  repositoryId: 9,
  owner: 'DavidJFelix',
  name: 'DavidJFelix',
  pullNumber: 769,
  headSha: oldSha,
  rerun: true,
}

test.each(['check_run', 'check_suite'] as const)(
  'handleReviewWebhook starts a review when a user reruns the %s',
  async (event) => {
    const workflow = fakeWorkflow()
    const dismissCheckRun = vi.fn<NonNullable<HandleReviewWebhookParams['dismissCheckRun']>>()
    const log = fakeLog()

    const response = await handleReviewWebhook({
      request: webhookRequest({payload: rerunEvent(event), event}),
      secret,
      workflow,
      dismissCheckRun,
      log,
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({status: 'started'})
    const runId = `9-769-rerun-${deliveryId}`
    expect(workflow.create).toHaveBeenCalledWith({id: runId, params: rerunParams})
    expect(dismissCheckRun).not.toHaveBeenCalled()
    expect(log.mock.calls).toEqual([
      [deliveryEvent({githubEvent: event, action: 'rerequested', decision: 'started', runId})],
    ])
  },
)

test('decideRerun uses the check id when the delivery has no id', () => {
  expect(
    decideRerun({event: 'check_suite', payload: rerunEvent('check_suite'), deliveryId: null}),
  ).toMatchObject({start: true, instanceId: '9-769-rerun-check_suite-31'})
})

test('decideRerun takes the pull request of this repository', () => {
  const payload = rerunEvent('check_run', {
    pull_requests: [
      {number: 4, base: {repo: {id: 77}}},
      {number: 769, base: {repo: {id: 9}}},
    ],
  })

  expect(decideRerun({event: 'check_run', payload, deliveryId})).toMatchObject({
    start: true,
    params: {pullNumber: 769},
  })
})

test.each([
  {name: 'another action', payload: {...rerunEvent('check_run'), action: 'completed'}},
  {name: 'a check of another app', payload: rerunEvent('check_run', {app: {slug: 'other-app'}})},
  {name: 'a check of no app', payload: rerunEvent('check_run', {app: null})},
  {name: 'a check without a pull request', payload: rerunEvent('check_run', {pull_requests: []})},
  {
    name: 'a pull request of another repository',
    payload: rerunEvent('check_run', {pull_requests: [{number: 4, base: {repo: {id: 77}}}]}),
  },
  {
    name: 'a repository that is not allowed',
    payload: {
      ...rerunEvent('check_run'),
      repository: {...pullRequestEvent.repository, full_name: 'acme/repo'},
    },
  },
  {name: 'a check suite payload for a check run event', payload: rerunEvent('check_suite')},
  {name: 'a payload of another shape', payload: {action: 'rerequested'}},
])('decideRerun ignores $name', ({payload}) => {
  expect(decideRerun({event: 'check_run', payload, deliveryId})).toMatchObject({start: false})
})
