// The caller sends the system prompt, the tool definitions and a callback with
// each request. OpenCode shows the model only these tools, and the callback
// runs each tool call on the side of the caller.

type JsonSchema = Readonly<Record<string, unknown>>

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema
}

export interface ToolCall {
  name: string
  // The arguments as JSON text.
  arguments: string
}

export interface ToolResult {
  content: string
}

export interface ReviewAgentRequest {
  prompt: string
  // Replaces the whole system prompt of OpenCode.
  system: string
  tools: readonly ToolDefinition[]
  // A function stub of Workers RPC. Put the error of a failed tool in
  // `content`: a rejection ends the turn.
  runTool: (call: ToolCall) => Promise<ToolResult>
  // The most model calls in one request.
  maxSteps: number
}

// A request while its caller waits for the answer. A prompt without tools has
// no callback and no step limit.
export type LiveRequest = Pick<ReviewAgentRequest, 'system' | 'tools'> &
  Partial<Pick<ReviewAgentRequest, 'runTool' | 'maxSteps'>>

type ToolSet = Pick<LiveRequest, 'tools' | 'maxSteps'>

export const REVIEW_AGENT_ID = 'review'

export const PROMPT_ONLY_SYSTEM = 'Answer the prompt.'

// OpenCode sets up one instance for each key, and the sessions with the same
// key share it. A session without a live request gets the key without tools.
export const toToolSetKey = (request?: LiveRequest): string =>
  JSON.stringify({tools: request?.tools ?? [], maxSteps: request?.maxSteps} satisfies ToolSet)

export interface CallerTool {
  name: string
  description: string
  input: JsonSchema
  // Without this, OpenCode lets the model call the tool only from JavaScript
  // in its `execute` tool.
  options: {codemode: false}
  execute: (input: unknown, context: {sessionID: string}) => Promise<ToolResult>
}

interface ToolEditor {
  list(): readonly {id: string}[]
  remove(id: string): void
  add(tool: CallerTool): void
}

interface AgentEditor {
  update(id: string, update: (agent: {steps?: number}) => void): void
}

export interface ContextEvent {
  readonly sessionID: string
  system: {type: 'text'; text: string}[]
}

// The part of the plugin context of OpenCode that the plugin uses.
export interface CallerToolsContext {
  tool: {transform: (edit: (editor: ToolEditor) => void) => Promise<unknown>}
  agent: {transform: (edit: (editor: AgentEditor) => void) => Promise<unknown>}
  session: {
    hook: (name: 'context', callback: (event: ContextEvent) => void) => Promise<unknown>
  }
}

export interface CallerToolsPlugin {
  id: string
  setup: (context: CallerToolsContext) => Promise<void>
}

export interface CallerToolsPluginParams {
  toolSetKey: string
  // The live requests by session id. The plugin removes the request of a
  // session whose callback fails.
  requests: Map<string, LiveRequest>
}

export function callerToolsPlugin({
  toolSetKey,
  requests,
}: CallerToolsPluginParams): CallerToolsPlugin {
  const {tools, maxSteps}: ToolSet = JSON.parse(toolSetKey)
  const callerTool = ({name, description, parameters}: ToolDefinition): CallerTool => ({
    name,
    description,
    input: parameters,
    options: {codemode: false},
    execute: async (input, {sessionID}) => {
      const runTool = requests.get(sessionID)?.runTool
      if (runTool === undefined) throw new Error(`The caller of session ${sessionID} is gone.`)
      try {
        return await runTool({name, arguments: JSON.stringify(input)})
      } catch (error) {
        requests.delete(sessionID)
        throw error
      }
    },
  })
  return {
    id: 'caller-tools',
    setup: async ({tool, agent, session}) => {
      await tool.transform((editor) => {
        for (const {id} of editor.list()) editor.remove(id)
        for (const definition of tools) editor.add(callerTool(definition))
      })
      if (maxSteps !== undefined) {
        await agent.transform((editor) => {
          editor.update(REVIEW_AGENT_ID, (info) => {
            info.steps = maxSteps
          })
        })
      }
      // OpenCode runs this hook before each model call. A session without a
      // live request stops here, so OpenCode makes no model call whose answer
      // nobody reads.
      await session.hook('context', (event) => {
        const request = requests.get(event.sessionID)
        if (request === undefined)
          throw new Error(`The caller of session ${event.sessionID} is gone.`)
        event.system = [{type: 'text', text: request.system}]
      })
    },
  }
}
