import type {ToolCall} from './lib/caller-tools'
import type {ReviewAgent, ReviewAgentEnv} from './review-agent'

// The Durable Object class must be a named export of the main module.
export {ReviewAgent} from './review-agent'

interface Env extends ReviewAgentEnv {
  REVIEW_AGENT: DurableObjectNamespace<ReviewAgent>
  // Only the smoke test sets this (bin/smoke.ts).
  SMOKE_TEST?: string
}

const SMOKE_PROMPT = 'Reply with the one word: ready'

// Each case is one request with one tool, and all of them run at the same time
// in one Durable Object. The callback of the case without content fails, as the
// callback of a caller that is gone.
const SMOKE_TOOL_CASES = [
  {tool: 'list_directory', content: 'a.ts\nb.ts'},
  {tool: 'read_file', content: 'L1 export {}'},
  {tool: 'read_definition', content: undefined},
]

const PATH_PARAMETERS = {
  type: 'object',
  properties: {path: {type: 'string'}},
  required: ['path'],
  additionalProperties: false,
}

const askWithTools = (agent: DurableObjectStub<ReviewAgent>) =>
  Promise.all(
    SMOKE_TOOL_CASES.map(async ({tool, content}) => {
      const system = `You review with the ${tool} tool.`
      const calls: ToolCall[] = []
      const answer = await agent.ask({
        prompt: `Call ${tool} once, then answer.`,
        system,
        tools: [
          {
            name: tool,
            description: `The ${tool} tool of the smoke test.`,
            parameters: PATH_PARAMETERS,
          },
        ],
        runTool: async (call) => {
          calls.push(call)
          if (content === undefined) throw new Error('The smoke test callback fails.')
          return {content}
        },
        maxSteps: 4,
      })
      return {tool, system, content, calls, answer}
    }),
  )

// The Worker has no public host, so only the smoke test reaches this handler.
export default {
  async fetch(request, env) {
    if (env.SMOKE_TEST !== 'true') return new Response('Not found', {status: 404})
    const agent = env.REVIEW_AGENT.getByName('smoke')
    switch (new URL(request.url).pathname) {
      case '/smoke':
        return Response.json(await agent.ask(SMOKE_PROMPT))
      case '/smoke/tools':
        return Response.json(await askWithTools(agent))
      default:
        return new Response('Not found', {status: 404})
    }
  },
} satisfies ExportedHandler<Env>
