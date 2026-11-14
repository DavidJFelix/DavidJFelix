import {DurableObject} from 'cloudflare:workers'
import {OpenCodeHarness} from 'agents/harness/opencode'
import {Lifecycle} from 'agents/lifecycle'
import {type ReviewAgentAnswer, summarizeUsage} from './lib/review-agent-answer'

const REVIEW_AGENT_MODEL = {providerID: 'openrouter', id: 'deepseek/deepseek-v4.1-flash-1017'}

export interface ReviewAgentEnv {
  // A Worker secret. Without it, OpenRouter refuses each model call.
  OPENROUTER_API_KEY?: string
  // Only the smoke test sets this, to send the model calls to its local server.
  OPENROUTER_BASE_URL?: string
}

// OpenCode runs in this Durable Object and keeps its sessions in the SQLite
// database of the object.
export class ReviewAgent extends DurableObject<ReviewAgentEnv> {
  private readonly harness = new OpenCodeHarness({
    opencode: async ({storage}) => {
      // OpenCode is most of the bundle. A static import runs all of it when the
      // Worker starts: about 450 ms of the 1 second that Cloudflare allows.
      const {OpenCodeWorkerd} = await import('@opencode/sdk/workerd')
      return OpenCodeWorkerd.create({
        storage,
        config: {
          default_agent: 'build',
          // OpenCode names each session with a second, small model of the same
          // provider. A review has no use for the name.
          agents: {title: {disabled: true}},
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
      })
    },
    defaults: {model: REVIEW_AGENT_MODEL, agent: 'build'},
  })

  constructor(ctx: DurableObjectState, env: ReviewAgentEnv) {
    super(ctx, env)
    // The Lifecycle starts the object again after an eviction, and OpenCode
    // then continues the turn.
    Lifecycle.install(this).use(this.harness)
  }

  async ask(prompt: string): Promise<ReviewAgentAnswer> {
    const session = await this.harness.sessions.create()
    const {status, text, reason, messages} = await session.prompt(prompt)
    return {status, text, reason, model: REVIEW_AGENT_MODEL.id, ...summarizeUsage(messages)}
  }
}
