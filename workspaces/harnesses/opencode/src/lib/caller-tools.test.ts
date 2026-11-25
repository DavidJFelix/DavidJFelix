import {expect, test, vi} from 'vitest'
import {
  type CallerTool,
  type CallerToolsContext,
  type ContextEvent,
  callerToolsPlugin,
  type LiveRequest,
  REVIEW_AGENT_ID,
  type ReviewAgentRequest,
  toToolSetKey,
} from './caller-tools'

const LIST_DIRECTORY = {
  name: 'list_directory',
  description: 'List a directory.',
  parameters: {type: 'object', properties: {path: {type: 'string'}}},
}

const SESSION = 'ses_live'

const liveRequest = (overrides: Partial<LiveRequest> = {}): LiveRequest => ({
  system: 'You review one pull request.',
  tools: [LIST_DIRECTORY],
  runTool: async () => ({content: 'a.ts\nb.ts'}),
  maxSteps: 3,
  ...overrides,
})

// Runs the plugin setup on a fake OpenCode that has two tools of its own.
async function setUpPlugin(request: LiveRequest) {
  const requests = new Map([[SESSION, request]])
  const tools = new Map<string, CallerTool | 'built-in'>([
    ['read', 'built-in'],
    ['shell', 'built-in'],
  ])
  const steps = new Map<string, number | undefined>()
  const hooks: ((event: ContextEvent) => void)[] = []
  const context: CallerToolsContext = {
    tool: {
      transform: async (edit) =>
        edit({
          list: () => [...tools.keys()].map((id) => ({id})),
          remove: (id) => tools.delete(id),
          add: (tool) => tools.set(tool.name, tool),
        }),
    },
    agent: {
      transform: async (edit) =>
        edit({
          update: (id, update) => {
            const agent: {steps?: number} = {}
            update(agent)
            steps.set(id, agent.steps)
          },
        }),
    },
    session: {hook: async (_name, callback) => hooks.push(callback)},
  }
  await callerToolsPlugin({toolSetKey: toToolSetKey(request), requests}).setup(context)
  const callerTool = (name: string) => {
    const tool = tools.get(name)
    if (tool === undefined || tool === 'built-in') throw new Error(`no caller tool ${name}`)
    return tool
  }
  const runHooks = (event: ContextEvent) => {
    for (const hook of hooks) hook(event)
  }
  return {requests, tools, steps, callerTool, runHooks}
}

test('a session without a live request shares the key of a request without tools', () => {
  expect(toToolSetKey()).toBe(toToolSetKey(liveRequest({tools: [], maxSteps: undefined})))
})

test('requests with the same tools and steps share a key', () => {
  const first = liveRequest({system: 'First.', runTool: async () => ({content: '1'})})
  const second = liveRequest({system: 'Second.', runTool: async () => ({content: '2'})})

  expect(toToolSetKey(first)).toBe(toToolSetKey(second))
})

test.each([
  ['other tools', {tools: [{...LIST_DIRECTORY, name: 'read_file'}]}],
  ['another step limit', {maxSteps: 4}],
])('requests with %s get another key', (_name, overrides) => {
  expect(toToolSetKey(liveRequest(overrides))).not.toBe(toToolSetKey(liveRequest()))
})

test('the model sees only the tools of the caller, as direct tool calls', async () => {
  const {tools, callerTool} = await setUpPlugin(liveRequest())

  expect([...tools.keys()]).toEqual(['list_directory'])
  expect(callerTool('list_directory')).toMatchObject({
    description: LIST_DIRECTORY.description,
    input: LIST_DIRECTORY.parameters,
    options: {codemode: false},
  })
})

test('a tool call runs the callback of its session with the arguments as JSON text', async () => {
  const runTool = vi.fn<ReviewAgentRequest['runTool']>(async () => ({content: 'a.ts'}))
  const {callerTool} = await setUpPlugin(liveRequest({runTool}))

  const result = await callerTool('list_directory').execute({path: ''}, {sessionID: SESSION})

  expect(result).toEqual({content: 'a.ts'})
  expect(runTool).toHaveBeenCalledWith({name: 'list_directory', arguments: '{"path":""}'})
})

test('a failed callback removes the live request of its session', async () => {
  const failure = new Error('The RPC stub is disconnected.')
  const {callerTool, requests} = await setUpPlugin(
    liveRequest({runTool: async () => Promise.reject(failure)}),
  )

  await expect(callerTool('list_directory').execute({path: ''}, {sessionID: SESSION})).rejects.toBe(
    failure,
  )
  expect(requests.has(SESSION)).toBe(false)
})

test('a tool call of a session without a live request fails', async () => {
  const {callerTool} = await setUpPlugin(liveRequest())

  await expect(
    callerTool('list_directory').execute({path: ''}, {sessionID: 'ses_gone'}),
  ).rejects.toThrow('The caller of session ses_gone is gone.')
})

test('the system prompt of the caller replaces the whole system prompt', async () => {
  const {runHooks} = await setUpPlugin(liveRequest())
  const event: ContextEvent = {
    sessionID: SESSION,
    system: [
      {type: 'text', text: 'You are an AI agent running in OpenCode.'},
      {type: 'text', text: '<env>Working directory: /bundle</env>'},
    ],
  }

  runHooks(event)

  expect(event.system).toEqual([{type: 'text', text: 'You review one pull request.'}])
})

test('a session without a live request stops before the model call', async () => {
  const {runHooks} = await setUpPlugin(liveRequest())

  expect(() => runHooks({sessionID: 'ses_gone', system: []})).toThrow(
    'The caller of session ses_gone is gone.',
  )
})

test('the step limit of the request goes to the review agent', async () => {
  const {steps} = await setUpPlugin(liveRequest({maxSteps: 5}))

  expect(Object.fromEntries(steps)).toEqual({[REVIEW_AGENT_ID]: 5})
})

test('a request without a step limit keeps the agent as it is', async () => {
  const {steps} = await setUpPlugin(liveRequest({maxSteps: undefined}))

  expect(steps.size).toBe(0)
})
