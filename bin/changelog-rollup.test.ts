import {expect, test} from 'bun:test'
import {mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {rollupChangelog, updateFilesList} from './changelog-rollup'

// Each test builds its own throwaway changelog dir (no lifecycle hooks).
function makeChangelogDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-rollup-'))
  mkdirSync(join(dir, 'fragments'))
  return dir
}

function read(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8')
}

test('creates the month file when none exists and deletes the folded fragment', async () => {
  const dir = makeChangelogDir()
  writeFileSync(
    join(dir, 'fragments', '2026-08-01-feat-demo-first.md'),
    '### feat(demo): first\n\nAdded the first demo.\n',
  )

  const result = await rollupChangelog({changelogDir: dir})

  expect(result).toEqual({folded: 1, months: ['2026-08']})
  expect(read(dir, '2026-08.md')).toBe(
    '# 2026-08\n\n## 2026-08-01\n\n### feat(demo): first\n\nAdded the first demo.\n',
  )
  expect(readdirSync(join(dir, 'fragments'))).toEqual([])
  rmSync(dir, {recursive: true, force: true})
})

test('adds a new day heading newest-first in an existing month, leaving old days untouched', async () => {
  const dir = makeChangelogDir()
  const oldDay = '## 2026-07-01\n\n### fix(app): old\n\nOld body kept as-is.\n'
  writeFileSync(join(dir, '2026-07.md'), `# 2026-07\n\n${oldDay}`)
  writeFileSync(
    join(dir, 'fragments', '2026-07-03-docs-repo-newer.md'),
    '### docs(repo): newer\n\nNewer body.\n',
  )

  await rollupChangelog({changelogDir: dir})

  expect(read(dir, '2026-07.md')).toBe(
    `# 2026-07\n\n## 2026-07-03\n\n### docs(repo): newer\n\nNewer body.\n\n${oldDay}`,
  )
  rmSync(dir, {recursive: true, force: true})
})

test('appends to an existing day heading after the entries already there', async () => {
  const dir = makeChangelogDir()
  writeFileSync(
    join(dir, '2026-07.md'),
    '# 2026-07\n\n## 2026-07-02\n\n### fix(app): earlier\n\nEarlier body.\n',
  )
  writeFileSync(
    join(dir, 'fragments', '2026-07-02-feat-app-later.md'),
    '### feat(app): later\n\nLater body.\n',
  )

  await rollupChangelog({changelogDir: dir})

  expect(read(dir, '2026-07.md')).toBe(
    '# 2026-07\n\n## 2026-07-02\n\n### fix(app): earlier\n\nEarlier body.\n\n' +
      '### feat(app): later\n\nLater body.\n',
  )
  rmSync(dir, {recursive: true, force: true})
})

test('folds multiple same-day fragments in filename order', async () => {
  const dir = makeChangelogDir()
  // Written in reverse order to prove the fold sorts by filename, not mtime.
  writeFileSync(join(dir, 'fragments', '2026-07-02-fix-app-beta.md'), '### fix(app): beta\n\nB.\n')
  writeFileSync(
    join(dir, 'fragments', '2026-07-02-feat-app-alpha.md'),
    '### feat(app): alpha\n\nA.\n',
  )

  await rollupChangelog({changelogDir: dir})

  expect(read(dir, '2026-07.md')).toBe(
    '# 2026-07\n\n## 2026-07-02\n\n### feat(app): alpha\n\nA.\n\n### fix(app): beta\n\nB.\n',
  )
  rmSync(dir, {recursive: true, force: true})
})

test('does nothing when the fragments directory holds only its README', async () => {
  const dir = makeChangelogDir()
  writeFileSync(join(dir, 'fragments', 'README.md'), '# Changelog fragments\n\nHow to write one.\n')
  const month = '# 2026-07\n\n## 2026-07-01\n\n### fix(app): only\n\nBody.\n'
  writeFileSync(join(dir, '2026-07.md'), month)

  const result = await rollupChangelog({changelogDir: dir})

  expect(result).toEqual({folded: 0, months: []})
  expect(read(dir, '2026-07.md')).toBe(month)
  expect(readdirSync(join(dir, 'fragments'))).toEqual(['README.md'])
  rmSync(dir, {recursive: true, force: true})
})

test('preserves fragment content byte-for-byte, including fenced pseudo-headings', async () => {
  const dir = makeChangelogDir()
  const body =
    '### chore(tooling): fenced content\n\nSteps taken:\n\n- one\n- two\n\n```bash\n' +
    "# comment inside a fence\necho '## not a day heading'\n```\n\nClosing paragraph."
  writeFileSync(join(dir, 'fragments', '2026-07-02-chore-tooling-fenced.md'), `${body}\n`)

  await rollupChangelog({changelogDir: dir})
  expect(read(dir, '2026-07.md')).toContain(body)

  // A second pass must reparse the month file without mistaking the fenced
  // "## not a day heading" line for structure.
  writeFileSync(
    join(dir, 'fragments', '2026-07-03-fix-app-followup.md'),
    '### fix(app): followup\n\nFollow-up body.\n',
  )
  await rollupChangelog({changelogDir: dir})

  expect(read(dir, '2026-07.md')).toBe(
    `# 2026-07\n\n## 2026-07-03\n\n### fix(app): followup\n\nFollow-up body.\n\n## 2026-07-02\n\n${body}\n`,
  )
  rmSync(dir, {recursive: true, force: true})
})

test('refreshes the README file list when a new month file appears', async () => {
  const dir = makeChangelogDir()
  writeFileSync(
    join(dir, 'README.md'),
    '# Changelog\n\nIntro prose.\n\n## Files\n\n- [2026-07.md](./2026-07.md)\n',
  )
  writeFileSync(join(dir, '2026-07.md'), '# 2026-07\n\n## 2026-07-01\n\n### fix(app): a\n\nA.\n')
  writeFileSync(join(dir, 'fragments', '2026-08-01-feat-app-b.md'), '### feat(app): b\n\nB.\n')

  await rollupChangelog({changelogDir: dir})

  expect(read(dir, 'README.md')).toBe(
    '# Changelog\n\nIntro prose.\n\n## Files\n\n- [2026-08.md](./2026-08.md)\n- [2026-07.md](./2026-07.md)\n',
  )
  rmSync(dir, {recursive: true, force: true})
})

test.each([
  ['bad_name.md', '### fix(app): entry\n\nBody.\n', /YYYY-MM-DD/u],
  ['2026-02-30-fix-app-fake-date.md', '### fix(app): entry\n\nBody.\n', /YYYY-MM-DD/u],
  ['2026-07-02-fix-app-no-heading.md', 'Just prose, no heading.\n', /must start with/u],
  ['2026-07-02-fix-app-h2.md', '### fix(app): entry\n\n## 2026-07-02\n', /reserved/u],
])('rejects invalid fragment %s without folding or deleting it', async (name, body, message) => {
  const dir = makeChangelogDir()
  writeFileSync(join(dir, 'fragments', name), body)

  await expect(rollupChangelog({changelogDir: dir})).rejects.toThrow(message)
  expect(readdirSync(join(dir, 'fragments'))).toEqual([name])
  expect(readdirSync(dir)).toEqual(['fragments'])
  rmSync(dir, {recursive: true, force: true})
})

test('updateFilesList leaves a README without a Files section unchanged', () => {
  const readme = '# Changelog\n\nNo file index here.\n'
  expect(updateFilesList({readme, months: ['2026-07']})).toBe(readme)
})
