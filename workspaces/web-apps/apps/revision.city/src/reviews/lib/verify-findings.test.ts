import {expect, test, vi} from 'vitest'
import type {ModelFinding} from './findings'
import {type Chat, OpenRouterError} from './openrouter'
import {MAX_VERIFIED_FINDINGS, verifyFindings} from './verify-findings'
import type {LogWideEvent} from './wide-event'

const usage = {promptTokens: 10, completionTokens: 5, costUsd: 0.01}

const finding = (changes: Partial<ModelFinding> = {}): ModelFinding => ({
  severity: 'high',
  title: 'Bug',
  body: 'Breaks',
  checked: true,
  label: 2,
  ...changes,
})

const answering = (...contents: string[]) => {
  let calls = 0
  return vi.fn<Chat>(async () => ({
    content: contents[Math.min(calls++, contents.length - 1)],
    toolCalls: [],
    usage,
  }))
}

const verify = (findings: ModelFinding[], chat: Chat) =>
  verifyFindings({findings, prompt: 'File: a.ts', chat, model: 'vendor/model'})

test('verifyFindings adds the proof to a confirmed finding', async () => {
  const chat = answering('{"confirmed": true, "proof": "a.ts line 2 drops the value."}')

  const verified = await verify([finding()], chat)

  expect(verified).toEqual({
    findings: [finding({body: 'Breaks\n\nProof: a.ts line 2 drops the value.'})],
    usage,
    reads: [],
  })
  const [{messages}] = chat.mock.calls[0]
  expect(messages[0].content).toContain('You see only the diff piece.')
  expect(messages[1].content).toBe(
    'File: a.ts\n\nFinding to check:\n{"severity":"high","title":"Bug","body":"Breaks","label":2,"endLabel":2}',
  )
})

test('verifyFindings marks a rejected finding as not checked', async () => {
  const chat = answering('{"confirmed": false, "proof": "Line 1 checks for null."}')

  const verified = await verify([finding()], chat)

  expect(verified.findings).toEqual([finding({checked: false})])
  expect(verified.error).toBeUndefined()
})

test.each([
  {verdict: 'confirmed', answer: '{"confirmed": true, "proof": "Yes."}'},
  {verdict: 'rejected', answer: '{"confirmed": false, "proof": "No."}'},
  {verdict: 'unparsed', answer: 'No JSON'},
])('verifyFindings logs the verdict $verdict for a checked finding', async ({verdict, answer}) => {
  const log = vi.fn<LogWideEvent>()

  await verifyFindings({
    findings: [finding({checked: false}), finding({severity: 'critical'})],
    prompt: 'File: a.ts',
    chat: answering(answer),
    model: 'vendor/model',
    eventFields: {reviewer: 'correctness', path: 'a.ts'},
    log,
  })

  expect(log.mock.calls).toEqual([
    [
      {
        event: 'finding check',
        reviewer: 'correctness',
        path: 'a.ts',
        finding: 2,
        severity: 'critical',
        verdict,
      },
    ],
  ])
})

test('verifyFindings logs the verdicts of a failed check and of a finding past the limit', async () => {
  const log = vi.fn<LogWideEvent>()
  const chat = vi.fn<Chat>(async () => {
    throw new OpenRouterError('OpenRouter returned 503: busy', true)
  })
  const findings = Array.from({length: MAX_VERIFIED_FINDINGS + 1}, (_, index) =>
    finding({label: index + 1}),
  )

  await verifyFindings({findings, prompt: 'File: a.ts', chat, model: 'vendor/model', log})

  expect(log.mock.calls.map(([{verdict}]) => verdict)).toEqual([
    ...Array.from({length: MAX_VERIFIED_FINDINGS}, () => 'failed'),
    'over-limit',
  ])
})

test('verifyFindings checks only the findings that the review would post', async () => {
  const chat = answering('{"confirmed": false, "proof": "No."}')
  const findings = [finding({checked: false}), finding({severity: 'low'})]

  const verified = await verify(findings, chat)

  expect(chat).not.toHaveBeenCalled()
  expect(verified).toEqual({
    findings,
    usage: {promptTokens: 0, completionTokens: 0, costUsd: 0},
    reads: [],
  })
})

test('verifyFindings does not post the findings past the limit', async () => {
  const chat = answering('{"confirmed": true, "proof": "Yes."}')
  const findings = Array.from({length: MAX_VERIFIED_FINDINGS + 1}, (_, index) =>
    finding({label: index + 1}),
  )

  const verified = await verify(findings, chat)

  expect(chat).toHaveBeenCalledTimes(MAX_VERIFIED_FINDINGS)
  expect(verified.findings.map(({checked}) => checked)).toEqual([
    ...Array.from({length: MAX_VERIFIED_FINDINGS}, () => true),
    false,
  ])
})

test('verifyFindings fails and does not post a finding whose check does not parse', async () => {
  const verified = await verify([finding()], answering('{"name": "read_file"}'))

  expect(verified.findings).toEqual([finding({checked: false})])
  expect(verified).toMatchObject({error: 'Finding check 1 did not parse', retryable: false})
})

test('verifyFindings fails and does not post a finding whose check call fails', async () => {
  const chat = vi.fn<Chat>(async () => {
    throw new OpenRouterError('OpenRouter returned 503: busy', true)
  })

  const verified = await verify([finding()], chat)

  expect(verified.findings).toEqual([finding({checked: false})])
  expect(verified).toMatchObject({
    error: 'Finding check 1 failed: Error: OpenRouter returned 503: busy',
    retryable: true,
  })
})

test('verifyFindings fails and does not post a finding whose check gives no proof', async () => {
  const verified = await verify([finding()], answering('{"confirmed": true, "proof": " "}'))

  expect(verified.findings).toEqual([finding({checked: false})])
  expect(verified).toMatchObject({error: 'Finding check 1 did not parse', retryable: false})
})

test('verifyFindings is retryable when any failed check is retryable', async () => {
  let calls = 0
  const chat = vi.fn<Chat>(async () => {
    calls += 1
    if (calls === 1) {
      return {content: 'No JSON', toolCalls: [], usage}
    }
    throw new OpenRouterError('OpenRouter returned 503: busy', true)
  })

  const verified = await verify([finding({label: 1}), finding({label: 2})], chat)

  expect(verified).toMatchObject({error: 'Finding check 1 did not parse', retryable: true})
})

test('verifyFindings checks the most severe findings within the limit', async () => {
  const chat = answering('{"confirmed": true, "proof": "Yes."}')
  const findings = [
    ...Array.from({length: MAX_VERIFIED_FINDINGS}, (_, index) =>
      finding({severity: 'medium', label: index + 1}),
    ),
    finding({severity: 'critical', label: 9}),
  ]

  const verified = await verify(findings, chat)

  expect(verified.findings.map(({checked}) => checked)).toEqual([
    ...Array.from({length: MAX_VERIFIED_FINDINGS - 1}, () => true),
    false,
    true,
  ])
})
