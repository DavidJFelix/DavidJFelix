import {expect, test} from 'vitest'
import {summarizeUsage} from './review-agent-answer'

test('adds the usage of each model call of one answer', () => {
  const usage = summarizeUsage([
    {type: 'user'},
    {
      type: 'assistant',
      tokens: {input: 1000, output: 20, reasoning: 5, cache: {read: 200, write: 0}},
      cost: 0.001,
    },
    {
      type: 'assistant',
      tokens: {input: 1500, output: 40, reasoning: 10, cache: {read: 1000, write: 0}},
      cost: 0.002,
    },
    {type: 'idle'},
  ])

  expect(usage).toEqual({
    inputTokens: 2500,
    outputTokens: 60,
    reasoningTokens: 15,
    cachedInputTokens: 1200,
    costUsd: 0.003,
  })
})

test('reports no usage for a transcript without a model call', () => {
  expect(summarizeUsage([{type: 'user'}, {type: 'idle'}])).toEqual({
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
    costUsd: 0,
  })
})

test('counts a model call that has tokens and no cost', () => {
  const usage = summarizeUsage([
    {type: 'assistant', tokens: {input: 10, output: 2, reasoning: 0, cache: {read: 0, write: 0}}},
  ])

  expect(usage).toMatchObject({inputTokens: 10, outputTokens: 2, costUsd: 0})
})
