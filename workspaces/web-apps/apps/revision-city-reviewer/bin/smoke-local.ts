/// <reference types="bun" />
// Pre-merge smoke gate: boots the Worker in workerd (`wrangler dev`) and sends
// one prompt through the ReviewAgent Durable Object. OpenCode starts in the
// object, calls the model, and returns the answer with its usage. A local
// server answers in place of OpenRouter, so the test needs no secret and no
// network.
//
// The Worker serves `/smoke` only when SMOKE_TEST is `true`, which only this
// script sets.

import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const PORT = Number(process.env.SMOKE_PORT ?? 4391)
const MODEL_PORT = Number(process.env.SMOKE_MODEL_PORT ?? 4392)
const BASE_URL = `http://127.0.0.1:${PORT}`
const READY_TIMEOUT_MS = 60_000
const ANSWER = 'ready'
const USAGE = {prompt_tokens: 1200, completion_tokens: 8, total_tokens: 1208, cost: 0.0001}

// A new directory for the Durable Object storage of each run. A session that
// an earlier run left open would continue in this run and call the model again.
const STATE_DIR = mkdtempSync(join(tmpdir(), 'revision-city-reviewer-smoke-'))

const modelCalls: string[] = []

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// One streamed chat completion in the format of OpenRouter: the text, the
// finish reason, and then the usage.
function streamAnswer(model: string): Response {
  const chunk = (fields: object) =>
    `data: ${JSON.stringify({id: 'smoke', object: 'chat.completion.chunk', created: 0, model, ...fields})}\n\n`
  return new Response(
    [
      chunk({
        choices: [{index: 0, delta: {role: 'assistant', content: ANSWER}, finish_reason: null}],
      }),
      chunk({choices: [{index: 0, delta: {}, finish_reason: 'stop'}]}),
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
    const body: unknown = await request.json()
    const model = isRecord(body) ? String(body.model) : ''
    modelCalls.push(model)
    return streamAnswer(model)
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

async function check(): Promise<string | null> {
  const response = await fetch(new URL('/smoke', BASE_URL), {signal: AbortSignal.timeout(60_000)})
  if (!response.ok) return `/smoke -> HTTP ${response.status}`
  const answer: unknown = await response.json()
  if (!isRecord(answer) || answer.status !== 'done' || answer.text !== ANSWER) {
    return `/smoke -> the harness did not answer: ${JSON.stringify(answer)}`
  }
  if (answer.costUsd !== USAGE.cost || answer.outputTokens !== USAGE.completion_tokens) {
    return `/smoke -> the answer has the wrong usage: ${JSON.stringify(answer)}`
  }
  // A second model call means that OpenCode used a model that the test did not ask for.
  if (modelCalls.length !== 1 || modelCalls[0] !== answer.model) {
    return `/smoke -> expected one call to ${String(answer.model)}, got ${JSON.stringify(modelCalls)}`
  }
  return null
}

let exitCode = 0
try {
  if (await waitForReady()) {
    const problem = await check()
    if (problem === null) {
      console.log('OK: the harness answered one prompt')
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
