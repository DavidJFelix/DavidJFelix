import {
  type Arbitrary,
  assert,
  constant,
  constantFrom,
  oneof,
  property,
  record,
  string,
  stringMatching,
} from 'fast-check'
import {expect, test} from 'vitest'
import {
  type CheckRunFields,
  type CheckRunState,
  checkRunLogic,
  decodeCheckRun,
  encodeCheckRun,
  type GitHubCheckRun,
} from './check-run-store'

const reviewOutput = {title: '1 finding', summary: 'Cost $0.01.', text: '### Findings'}

const STATES = {
  'in-progress': {status: 'in-progress'},
  superseded: {status: 'superseded', reviewOutput},
  passed: {status: 'passed', reviewOutput},
  failed: {status: 'failed', reviewOutput},
  'failed-resolvable': {status: 'failed-resolvable', reviewOutput},
  resolved: {status: 'resolved', reviewOutput},
  dismissed: {status: 'dismissed', reviewOutput, dismissedBy: 'maintainer'},
} satisfies Record<CheckRunState['status'], CheckRunState>

type Status = keyof typeof STATES

const EVENTS = [
  {type: 'completed', outcome: 'failed', output: reviewOutput},
  {type: 'threadsResolved'},
  {type: 'threadReopened'},
  {type: 'dismissed', by: 'maintainer'},
] as const

interface LegalTransition {
  type: (typeof EVENTS)[number]['type']
  from: Status
  to: Status
}

const LEGAL: LegalTransition[] = [
  {type: 'completed', from: 'in-progress', to: 'failed'},
  {type: 'threadsResolved', from: 'failed-resolvable', to: 'resolved'},
  {type: 'threadReopened', from: 'resolved', to: 'failed-resolvable'},
  {type: 'dismissed', from: 'failed', to: 'dismissed'},
  {type: 'dismissed', from: 'failed-resolvable', to: 'dismissed'},
]

const transitions = EVENTS.flatMap((event) =>
  Object.values(STATES).map((from) => {
    const legal = LEGAL.find((entry) => entry.type === event.type && entry.from === from.status)
    const to: Status | 'no change' = legal?.to ?? 'no change'
    return {event, type: event.type, from, to}
  }),
)

test.each(transitions)('checkRunLogic: $type in $from.status leads to $to', ({event, from, to}) => {
  const store = checkRunLogic.createStore(from)
  const snapshot = store.getSnapshot()

  const [next] = store.transition(snapshot, event)

  expect(next.context).toEqual(to === 'no change' ? from : STATES[to])
  // The store keeps the snapshot only for an event that is not legal.
  expect(next === snapshot).toBe(to === 'no change')
})

test.each(Object.values(STATES))(
  'encodeCheckRun shows the dismiss button on a $status check run only when a dismissal is legal',
  (state) => {
    const fields = encodeCheckRun(state)

    expect(fields.status === 'completed' && fields.actions.length > 0).toBe(
      checkRunLogic.createStore(state).can.dismissed({by: 'maintainer'}),
    )
  },
)

const githubCheckRun = (changes: Partial<GitHubCheckRun>): GitHubCheckRun => ({
  status: 'completed',
  conclusion: 'success',
  external_id: null,
  output: {title: '1 finding', summary: 'Cost $0.01.', text: null},
  ...changes,
})

test.each([
  {name: 'a queued check run', checkRun: githubCheckRun({status: 'queued'}), status: 'in-progress'},
  {
    name: 'a failure report after a dismissal',
    checkRun: githubCheckRun({conclusion: 'failure', external_id: 'dismissed'}),
    status: 'failed',
  },
  {
    name: 'a conclusion that only GitHub sets',
    checkRun: githubCheckRun({conclusion: 'stale'}),
    status: 'superseded',
  },
])('decodeCheckRun reads $name as $status', ({checkRun, status}) => {
  expect(decodeCheckRun(checkRun).status).toBe(status)
})

test('decodeCheckRun keeps a resolved title without the prefix, and reads a missing summary as empty', () => {
  expect(
    decodeCheckRun(
      githubCheckRun({
        external_id: 'resolvable-findings',
        output: {title: '1 finding', summary: null, text: null},
      }),
    ),
  ).toEqual({status: 'resolved', reviewOutput: {title: '1 finding', summary: ''}})
})

const outputs = record(
  {title: string(), summary: string(), text: string()},
  {requiredKeys: ['title', 'summary']},
)

const states: Arbitrary<CheckRunState> = oneof(
  constant<CheckRunState>({status: 'in-progress'}),
  record({
    status: constantFrom('superseded', 'passed', 'failed', 'failed-resolvable', 'resolved'),
    reviewOutput: outputs,
  }),
  record({
    status: constant('dismissed'),
    reviewOutput: outputs,
    dismissedBy: stringMatching(/^[A-Za-z0-9-]{1,39}$/),
  }),
)

const newCheckRun: GitHubCheckRun = {
  status: 'in_progress',
  conclusion: null,
  external_id: null,
  output: {title: null, summary: null, text: null},
}

// The check run as GitHub returns it after the app writes the fields. GitHub
// keeps the external id when the fields do not send one.
function updated(before: GitHubCheckRun, fields: CheckRunFields): GitHubCheckRun {
  if (fields.status === 'in_progress') {
    return {...before, status: 'in_progress'}
  }
  const {conclusion, external_id: externalId, output} = fields
  return {
    status: 'completed',
    conclusion,
    external_id: externalId ?? before.external_id,
    output: {title: output.title, summary: output.summary, text: output.text ?? null},
  }
}

test('decodeCheckRun reads back each state that encodeCheckRun writes', () => {
  assert(
    property(states, (state) => {
      expect(decodeCheckRun(updated(newCheckRun, encodeCheckRun(state)))).toEqual(state)
    }),
  )
})

test.each(['resolvable-findings', 'dismissed'])(
  'a failure report on a check run with the external id %s reads as failed',
  (externalId) => {
    const before = githubCheckRun({external_id: externalId})

    const after = updated(before, encodeCheckRun(STATES.failed))

    expect(decodeCheckRun(after)).toEqual(STATES.failed)
  },
)
