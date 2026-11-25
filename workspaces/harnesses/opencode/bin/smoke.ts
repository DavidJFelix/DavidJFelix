/// <reference types="bun" />
// Pre-merge smoke gate: boots the Worker in workerd (`wrangler dev`) and sends
// requests through the ReviewAgent Durable Object. OpenCode starts in the
// object, calls the model, and returns the answers with their usage. A local
// server answers in place of OpenRouter, so the test needs no secret and no
// network.
//
// 1. `/smoke` sends a prompt string. The model must get no tools and the short
//    system prompt of the harness.
// 2. `/smoke/tools` sends three requests at the same time, each with one tool.
//    The model must get only the tool and the system prompt of its request.
//    The tool result must be in the next model call. The request whose
//    callback fails must end without another model call.
//
// The Worker serves these paths only when SMOKE_TEST is `true`, which only this
// script sets.

import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PROMPT_ONLY_SYSTEM} from '../src/lib/caller-tools'

const PORT = Number(process.env.SMOKE_PORT ?? 4391)
const MODEL_PORT = Number(process.env.SMOKE_MODEL_PORT ?? 4392)
const BASE_URL = `http://127.0.0.1:${PORT}`
const READY_TIMEOUT_MS = 60_000
const ANSWER = 'ready'
const TOOL_ARGUMENTS = JSON.stringify({path: ''})
const USAGE = {prompt_tokens: 1200, completion_tokens: 8, total_tokens: 1208, cost: 0.0001}

// A new directory for the Durable Object storage of each run. A session that
// an earlier run left open would continue in this run and call the model again.
const STATE_DIR = mkdtempSync(join(tmpdir(), 'harness-opencode-smoke-'))

interface ModelCall {
  model: string
  system: string
  tools: string[]
  last?: Record<string, unknown>
}

const modelCalls: ModelCall[] = []

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

// The fields of an OpenRouter chat request that the checks read.
function toModelCall(body: unknown): ModelCall {
  const request = isRecord(body) ? body : {}
  const messages = records(request.messages)
  return {
    model: String(request.model),
    system: messages
      .filter(({role}) => role === 'system')
      .map(({content}) => String(content))
      .join('\n'),
    tools: records(request.tools).map((tool) =>
      isRecord(tool.function) ? String(tool.function.name) : '',
    ),
    last: messages.at(-1),
  }
}

// The model calls the first tool once, then answers with the tool result. A
// request without tools gets the answer `ready`.
function reply({tools, last}: ModelCall): object {
  if (last?.role === 'user' && tools.length > 0) {
    const call = {
      index: 0,
      id: 'call_smoke',
      type: 'function',
      function: {name: tools[0], arguments: TOOL_ARGUMENTS},
    }
    return {role: 'assistant', content: null, tool_calls: [call]}
  }
  return {
    role: 'assistant',
    content: last?.role === 'tool' ? `done: ${String(last.content)}` : ANSWER,
  }
}

// One streamed chat completion in the format of OpenRouter: the message, the
// finish reason, and then the usage.
function streamAnswer(call: ModelCall): Response {
  const delta = reply(call)
  const chunk = (fields: object) =>
    `data: ${JSON.stringify({id: 'smoke', object: 'chat.completion.chunk', created: 0, model: call.model, ...fields})}\n\n`
  return new Response(
    [
      chunk({choices: [{index: 0, delta, finish_reason: null}]}),
      chunk({
        choices: [
          {index: 0, delta: {}, finish_reason: 'tool_calls' in delta ? 'tool_calls' : 'stop'},
        ],
      }),
      chunk({choices: [], usage: USAGE}),
      'data: [DONE]\n\n',
    ].join(''),
    {headers: {'content-type': 'text/event-stream'}},
  )
}

const modelServer = Bun.serve({
  port: MODEL_PORT,
  hostname: '127.0.0.1',
  async fetch(request) {
    if (!new URL(request.url).pathname.endsWith('/chat/completions')) {
      return new Response('Not found', {status: 404})
    }
    const call = toModelCall(await request.json())
    modelCalls.push(call)
    return streamAnswer(call)
  },
})

// The script starts the wrangler binary itself, not through `bun run`. A kill
// of the `bun run` wrapper does not stop the server, which then keeps the port.
const worker = Bun.spawn(
  [
    'node_modules/.bin/wrangler',
    'dev',
    '--ip',
    '127.0.0.1',
    '--port',
    String(PORT),
    '--persist-to',
    STATE_DIR,
    '--var',
    'SMOKE_TEST:true',
    '--var',
    'OPENROUTER_API_KEY:smoke',
    '--var',
    `OPENROUTER_BASE_URL:http://127.0.0.1:${MODEL_PORT}/api/v1`,
  ],
  {env: {...process.env, CI: 'true'}, stdout: 'ignore', stderr: 'ignore'},
)

// Any HTTP answer means that the Worker runs. `/` answers 404.
async function waitForReady(deadline = Date.now() + READY_TIMEOUT_MS): Promise<boolean> {
  try {
    await fetch(BASE_URL, {signal: AbortSignal.timeout(2_000)})
    return true
  } catch {
    if (Date.now() >= deadline) return false
  }
  await Bun.sleep(500)
  return waitForReady(deadline)
}

async function get(path: string): Promise<unknown> {
  const response = await fetch(new URL(path, BASE_URL), {signal: AbortSignal.timeout(60_000)})
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`)
  return response.json()
}

const sameList = (actual: readonly string[], expected: readonly string[]) =>
  JSON.stringify(actual) === JSON.stringify(expected)

async function checkPrompt(): Promise<string | null> {
  const answer = await get('/smoke')
  if (!isRecord(answer) || answer.status !== 'done' || answer.text !== ANSWER) {
    return `/smoke -> the harness did not answer: ${JSON.stringify(answer)}`
  }
  if (answer.costUsd !== USAGE.cost || answer.outputTokens !== USAGE.completion_tokens) {
    return `/smoke -> the answer has the wrong usage: ${JSON.stringify(answer)}`
  }
  // A second model call means that OpenCode used a model that the test did not ask for.
  const [call, ...others] = modelCalls
  if (call === undefined || others.length > 0 || call.model !== answer.model) {
    return `/smoke -> expected one call to ${String(answer.model)}, got ${JSON.stringify(modelCalls)}`
  }
  if (call.tools.length > 0 || call.system !== PROMPT_ONLY_SYSTEM) {
    return `/smoke -> the model got more than the prompt: ${JSON.stringify(call)}`
  }
  return null
}

function checkToolCase(result: Record<string, unknown>): string | null {
  const tool = String(result.tool)
  const {system, calls} = result
  const content = typeof result.content === 'string' ? result.content : undefined
  const answer = isRecord(result.answer) ? result.answer : {}
  const callsOfCase = modelCalls.filter((call) => call.system === system)
  const wrongTools = callsOfCase.find((call) => !sameList(call.tools, [tool]))
  if (wrongTools !== undefined) {
    return `${tool}: the model got the tools ${JSON.stringify(wrongTools.tools)}`
  }
  if (JSON.stringify(calls) !== JSON.stringify([{name: tool, arguments: TOOL_ARGUMENTS}])) {
    return `${tool}: the callback got ${JSON.stringify(calls)}`
  }
  if (content === undefined) {
    return answer.status === 'unanswered' && callsOfCase.length === 1
      ? null
      : `${tool}: a failed callback did not end the turn: ${JSON.stringify({answer, callsOfCase})}`
  }
  const [, second] = callsOfCase
  if (
    callsOfCase.length !== 2 ||
    second?.last?.role !== 'tool' ||
    second.last.content !== content
  ) {
    return `${tool}: the tool result is not in the next model call: ${JSON.stringify(callsOfCase)}`
  }
  return answer.status === 'done' && answer.text === `done: ${content}` && answer.toolCalls === 1
    ? null
    : `${tool}: the harness did not answer: ${JSON.stringify(answer)}`
}

async function checkTools(): Promise<string | null> {
  const results = records(await get('/smoke/tools'))
  const problems = results.map(checkToolCase).filter((problem) => problem !== null)
  if (results.length === 0) problems.push('no request ran')
  return problems.length === 0 ? null : `/smoke/tools -> ${problems.join('; ')}`
}

let exitCode = 0
try {
  if (await waitForReady()) {
    const problem = (await checkPrompt()) ?? (await checkTools())
    if (problem === null) {
      console.log('OK: the harness answered a prompt and ran the tools of three requests')
    } else {
      console.error(`::error::smoke test failed — ${problem}`)
      exitCode = 1
    }
  } else {
    console.error(
      `::error::the Worker did not become ready on ${BASE_URL} within ${READY_TIMEOUT_MS}ms`,
    )
    exitCode = 1
  }
} finally {
  worker.kill()
  await Promise.race([worker.exited, Bun.sleep(3_000)])
  worker.kill('SIGKILL')
  await modelServer.stop(true)
  rmSync(STATE_DIR, {recursive: true, force: true})
}

process.exit(exitCode)
