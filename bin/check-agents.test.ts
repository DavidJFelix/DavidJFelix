import {expect, test} from 'bun:test'
import {mkdirSync, mkdtempSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {checkMirror, checkPersona} from './check-agents'

// Each test builds its own throwaway .agents/.claude tree (no lifecycle hooks).
function makeTree(): {root: string; solidDir: string; linkDir: string} {
  const root = mkdtempSync(join(tmpdir(), 'check-agents-'))
  const solidDir = join(root, '.agents/agents')
  const linkDir = join(root, '.claude/agents')
  mkdirSync(solidDir, {recursive: true})
  mkdirSync(linkDir, {recursive: true})
  return {root, solidDir, linkDir}
}

function addPersona(params: {solidDir: string; linkDir: string; name: string}): void {
  const {solidDir, linkDir, name} = params
  writeFileSync(
    join(solidDir, `${name}.md`),
    `---\nname: ${name}\ndescription: A persona for testing.\n---\n\nBody.\n`,
  )
  symlinkSync(`../../.agents/agents/${name}.md`, join(linkDir, `${name}.md`))
}

test('a valid persona with an intact mirror produces no findings', () => {
  const {solidDir, linkDir} = makeTree()
  addPersona({solidDir, linkDir, name: 'tester'})
  const text = `---\nname: tester\ndescription: A persona for testing.\n---\n\nBody.\n`
  expect(checkPersona({file: '.agents/agents/tester.md', text})).toEqual([])
  expect(checkMirror({solidDir, linkDir})).toEqual([])
})

test('an unquoted colon-space in the description fails strict YAML parsing', () => {
  const text = `---\nname: judge\ndescription: judges whether it is safe to ship: auth, secrets\n---\n\nBody.\n`
  const findings = checkPersona({file: '.agents/agents/judge.md', text})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('not strict YAML')
})

test('a frontmatter name that does not match the filename is flagged', () => {
  const text = `---\nname: old-name\ndescription: A persona for testing.\n---\n\nBody.\n`
  const findings = checkPersona({file: '.agents/agents/new-name.md', text})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('does not match filename')
})

test('a missing description is flagged', () => {
  const text = `---\nname: quiet\n---\n\nBody.\n`
  const findings = checkPersona({file: '.agents/agents/quiet.md', text})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('missing or empty description')
})

test('a file without a frontmatter block is flagged', () => {
  const findings = checkPersona({file: '.agents/agents/bare.md', text: '# Just a heading\n'})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('missing frontmatter block')
})

test('an empty frontmatter block is flagged, not thrown on', () => {
  const findings = checkPersona({file: '.agents/agents/empty.md', text: '---\n\n---\n\nBody.\n'})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('not a YAML mapping')
})

test('scalar frontmatter that is not a mapping is flagged', () => {
  const findings = checkPersona({file: '.agents/agents/scalar.md', text: '---\njust text\n---\n'})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('not a YAML mapping')
})

test('a solid persona without a symlink is flagged', () => {
  const {solidDir, linkDir} = makeTree()
  writeFileSync(join(solidDir, 'lonely.md'), '---\nname: lonely\ndescription: x\n---\n')
  const findings = checkMirror({solidDir, linkDir})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('missing symlink')
})

test('a flattened symlink (regular file in the link dir) is flagged', () => {
  const {solidDir, linkDir} = makeTree()
  addPersona({solidDir, linkDir, name: 'tester'})
  writeFileSync(join(linkDir, 'flat.md'), 'a regular file, not a link')
  const findings = checkMirror({solidDir, linkDir})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('not a symlink')
})

test('a symlink pointing outside the solid dir is flagged', () => {
  const {root, solidDir, linkDir} = makeTree()
  writeFileSync(join(root, 'elsewhere.md'), 'not a persona')
  writeFileSync(join(solidDir, 'stray.md'), '---\nname: stray\ndescription: x\n---\n')
  symlinkSync('../../elsewhere.md', join(linkDir, 'stray.md'))
  const findings = checkMirror({solidDir, linkDir})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('expected')
})

test('a dangling symlink whose solid copy was deleted is flagged', () => {
  const {solidDir, linkDir} = makeTree()
  symlinkSync('../../.agents/agents/gone.md', join(linkDir, 'gone.md'))
  const findings = checkMirror({solidDir, linkDir})
  expect(findings).toHaveLength(1)
  expect(findings[0]).toContain('dangling')
})
