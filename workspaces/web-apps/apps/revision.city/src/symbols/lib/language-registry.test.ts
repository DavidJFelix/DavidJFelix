import {expect, test} from 'vitest'

import {detectLanguage, LANGUAGES} from './language-registry'

test.each([
  ['src/router.tsx', 'tsx'],
  ['src/lib/thing.ts', 'typescript'],
  ['src/types/env.d.ts', 'typescript'],
  ['src/lib/thing.test.tsx', 'tsx'],
  ['scripts/build.mjs', 'javascript'],
  ['api/handler.py', 'python'],
  ['crates/core/src/lib.rs', 'rust'],
  ['cmd/main.go', 'go'],
  ['src/Widget.java', 'java'],
  ['include/widget.hpp', 'cpp'],
  ['src/index.php', 'php'],
  ['styles/app.css', 'css'],
  ['styles/app.scss', 'sass'],
  ['README.md', 'markdown'],
  ['package.json', 'json'],
  ['.github/workflows/ci.yml', 'yaml'],
])('detects %s as %s', (path, expected) => {
  expect(detectLanguage(path)?.id).toBe(expected)
})

test.each([['Makefile'], ['.gitignore'], ['bin/tool'], ['image.png']])(
  'returns no language for %s',
  (path) => {
    expect(detectLanguage(path)).toBeUndefined()
  },
)

test('matches extensions case-insensitively', () => {
  expect(detectLanguage('docs/README.MD')?.id).toBe('markdown')
})

test('claims every extension exactly once across the registry', () => {
  const extensions = LANGUAGES.flatMap((language) => language.extensions)

  expect(new Set(extensions).size).toBe(extensions.length)
})

test('loads a parser for every registered language', async () => {
  const parsers = await Promise.all(LANGUAGES.map((language) => language.loadParser()))

  expect(parsers.every((parser) => typeof parser.parse === 'function')).toBe(true)
})
