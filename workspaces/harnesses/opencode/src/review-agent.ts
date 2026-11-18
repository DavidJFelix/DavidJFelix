import {DurableObject} from 'cloudflare:workers'
import {OpenCodeHarness} from 'agents/harness/opencode'
import {Lifecycle} from 'agents/lifecycle'
import {
  callerToolsPlugin,
  type LiveRequest,
  PROMPT_ONLY_SYSTEM,
  REVIEW_AGENT_ID,
  type ReviewAgentRequest,
  toToolSetKey,
} from './lib/caller-tools'
import {countToolCalls, type ReviewAgentAnswer, summarizeUsage} from './lib/review-agent-answer'

const REVIEW_AGENT_MODEL = {providerID: 'openrouter', id: 'deepseek/deepseek-v4.1-flash'}

export interface ReviewAgentEnv {
  // A Worker secret. Without it, OpenRouter refuses each model call.
  OPENROUTER_API_KEY?: string
  // Only the smoke test sets this, to send the model calls to its local server.
  OPENROUTER_BASE_URL?: string
}

// OpenCode runs in this Durable Object and keeps its sessions in the SQLite
// database of the object.
export class ReviewAgent extends DurableObject<ReviewAgentEnv> {
  // Only memory holds the callbacks. After an eviction this map is empty, so a
  // session that OpenCode continues has no live request.
  private readonly requests = new Map<string, LiveRequest>()

  private readonly harness = new OpenCodeHarness({
    opencode: async ({storage}) => {
      // OpenCode is most of the bundle. A static import runs all of it when the
      // Worker starts: about 250 ms of the 1 second that Cloudflare allows.
      const {OpenCodeWorkerd} = await import('@opencode/sdk/workerd')
      return OpenCodeWorkerd.create({
        storage,
        config: {
          default_agent: REVIEW_AGENT_ID,
          agents: {
            // OpenCode names each session with a second, small model of the
            // same provider. A review has no use for the name.
            title: {disabled: true},
            // The deny rule turns off Code Mode: the `execute` tool, which runs
            // JavaScript with `fetch`.
            [REVIEW_AGENT_ID]: {
              mode: 'primary',
              permissions: [{action: 'execute', resource: '*', effect: 'deny'}],
            },
          },
          providers: {
            openrouter: {
              settings: {
                apiKey: this.env.OPENROUTER_API_KEY,
                ...(this.env.OPENROUTER_BASE_URL ? {baseURL: this.env.OPENROUTER_BASE_URL} : {}),
              },
            },
          },
        },
        // OpenCode reads the model list in its package. It does not download a
        // newer list from models.dev.
        models: {fetch: false},
        instances: {
          key: (session) => toToolSetKey(this.requests.get(session.id)),
          configure: (key) => ({
            plugins: [callerToolsPlugin({toolSetKey: key, requests: this.requests})],
          }),
        },
      })
    },
    defaults: {model: REVIEW_AGENT_MODEL, agent: REVIEW_AGENT_ID},
  })

  constructor(ctx: DurableObjectState, env: ReviewAgentEnv) {
    super(ctx, env)
    // The Lifecycle starts the object again after an eviction, and OpenCode
    // then continues the turn.
    Lifecycle.install(this).use(this.harness)
  }

  // revision.city sends a prompt string until its probe sends a request.
  async ask(input: string | ReviewAgentRequest): Promise<ReviewAgentAnswer> {
    const {prompt, ...request} =
      typeof input === 'string' ? {prompt: input, system: PROMPT_ONLY_SYSTEM, tools: []} : input
    const session = await this.harness.sessions.create()
    this.requests.set(session.id, request)
    try {
      const {status, text, reason, messages} = await session.prompt(prompt)
      return {
        status,
        text,
        reason,
        model: REVIEW_AGENT_MODEL.id,
        toolCalls: countToolCalls(messages),
        ...summarizeUsage(messages),
      }
    } finally {
      this.requests.delete(session.id)
    }
  }
}
