import {expect, test, vi} from 'vitest'
import type {ModelFinding} from './findings'
import {type Chat, OpenRouterError} from './openrouter'
import {MAX_VERIFIED_FINDINGS, verifyFindings} from './verify-findings'

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
