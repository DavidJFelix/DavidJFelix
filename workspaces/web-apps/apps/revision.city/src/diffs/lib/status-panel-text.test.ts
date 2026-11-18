// @vitest-environment node
import {expect, test} from 'vitest'

import {CODEBERG_HOST} from './codeberg-diff-source'
import {statusPanelText} from './status-panel-text'

test('statusPanelText names the highlighter when the patch shows and the files do not', () => {
  for (const state of ['streaming', 'ready'] as const) {
    expect(
      statusPanelText({errorMessage: null, sourceName: 'GitHub', state, waitingFor: 'highlighter'}),
    ).toEqual({
      title: 'Starting syntax highlighting',
      message: 'The files show when the highlighter is ready…',
    })
  }
})

test('statusPanelText names the host that the patch comes from', () => {
  expect(
    statusPanelText({
      errorMessage: null,
      sourceName: CODEBERG_HOST,
      state: 'fetching',
      waitingFor: 'patch',
    }).message,
  ).toBe(`Fetching the patch from ${CODEBERG_HOST}…`)
  expect(
    statusPanelText({
      errorMessage: null,
      sourceName: 'GitHub',
      state: 'fetching',
      waitingFor: 'patch',
    }).message,
  ).toBe('Fetching the patch from GitHub…')
})

test('statusPanelText keeps the patch text while the patch loads', () => {
  expect(
    statusPanelText({
      errorMessage: null,
      sourceName: 'GitHub',
      state: 'parsing',
      waitingFor: 'patch',
    }).title,
  ).toBe('Preparing diff')
  expect(
    statusPanelText({
      errorMessage: null,
      sourceName: 'GitHub',
      state: 'streaming',
      waitingFor: 'patch',
    }).title,
  ).toBe('Streaming diff')
})

test('statusPanelText shows the error message, also when the patch shows', () => {
  expect(
    statusPanelText({
      errorMessage: 'Not found',
      sourceName: 'GitHub',
      state: 'error',
      waitingFor: 'highlighter',
    }),
  ).toEqual({title: 'Couldn’t load diff', message: 'Not found'})
  expect(
    statusPanelText({errorMessage: null, sourceName: 'GitHub', state: 'error', waitingFor: 'patch'})
      .message,
  ).toBe('Failed to fetch the diff, please try again.')
})
