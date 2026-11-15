import {processFile, type SupportedLanguages} from '@pierre/diffs'
import {expect, test} from 'vitest'

import {createGrammarPreloader} from './preload-grammars'

function parseFileDiff(path: string) {
  const fileDiff = processFile(
    [
      `diff --git a/${path} b/${path}`,
      'index 1111111..2222222 100644',
      `--- a/${path}`,
      `+++ b/${path}`,
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '',
    ].join('\n'),
    {isGitDiff: true},
  )
  if (fileDiff === undefined) {
    throw new Error(`no file diff for ${path}`)
  }
  return fileDiff
}

function recordResolves() {
  const resolved: SupportedLanguages[][] = []
  const preload = createGrammarPreloader({
    resolve: async (languages) => {
      resolved.push(languages)
    },
  })
  return {preload, resolved}
}

test('each language of the PR is resolved once, in the order its first file arrives', () => {
  const {preload, resolved} = recordResolves()

  for (const path of ['src/main.go', 'src/util.go', 'app.py', 'src/lib.go', 'build.rs']) {
    preload(parseFileDiff(path))
  }

  expect(resolved).toEqual([['go'], ['python'], ['rust']])
})

test('a file the library draws as plain text resolves no grammar', () => {
  const {preload, resolved} = recordResolves()

  preload(parseFileDiff('notes.txt'))
  preload(parseFileDiff('LICENSE'))

  expect(resolved).toEqual([])
})

test('a language set on the file wins over its file name', () => {
  const {preload, resolved} = recordResolves()

  preload({...parseFileDiff('script'), lang: 'python'})

  expect(resolved).toEqual([['python']])
})

test('a failed resolve is not retried and does not throw', async () => {
  const attempts: SupportedLanguages[][] = []
  const preload = createGrammarPreloader({
    resolve: (languages) => {
      attempts.push(languages)
      return Promise.reject(new Error('grammar fetch failed'))
    },
  })

  preload(parseFileDiff('main.go'))
  preload(parseFileDiff('other.go'))
  await Promise.resolve()

  expect(attempts).toEqual([['go']])
})
