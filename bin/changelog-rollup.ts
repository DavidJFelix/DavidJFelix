#!/usr/bin/env bun
// Fold changelog fragments (docs/changelog/fragments/*.md) into the monthly
// files (docs/changelog/YYYY-MM.md), then delete the folded fragments and
// refresh the file index in docs/changelog/README.md.
//
// Fragments are named YYYY-MM-DD-<type>-<scope>-<short-slug>.md and contain
// exactly one entry: a "### type(scope): description" heading plus prose.
// The monthly files are only ever written by this script -- PRs add fragments,
// never edit YYYY-MM.md, so parallel branches cannot conflict.
//
// Folding rules: the month file and "## YYYY-MM-DD" day heading are created as
// needed, days are ordered newest-first, fragments folded into the same day
// land in filename order after any entries already there, and fragment content
// is preserved byte-for-byte (fragments are Prettier-gated by ci-docs, so the
// assembled file stays Prettier-clean).
//
// Entry point: `mise run changelog:rollup`.

import {readdir, rm} from 'node:fs/promises'
import {join} from 'node:path'

export interface Fragment {
  name: string
  date: string
  month: string
  body: string
}

export interface DaySection {
  date: string
  entries: string
}

export interface MonthDoc {
  header: string
  days: DaySection[]
}

export interface RollupResult {
  folded: number
  months: string[]
}

const fragmentNamePattern = /^(\d{4})-(\d{2})-(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u

export function parseFragmentName(name: string): {date: string; month: string} | null {
  const match = name.match(fragmentNamePattern)
  if (!match) return null
  const [, year, month, day] = match
  const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const isRealDate =
    utc.getUTCFullYear() === Number(year) &&
    utc.getUTCMonth() === Number(month) - 1 &&
    utc.getUTCDate() === Number(day)
  if (!isRealDate) return null
  return {date: `${year}-${month}-${day}`, month: `${year}-${month}`}
}

// Fenced code blocks may contain lines that look like headings; both fragment
// validation and month-file parsing must not treat those as structure.
function isFenceDelimiter(line: string): boolean {
  return /^ {0,3}(?:```|~~~)/u.test(line)
}

export function validateFragmentBody({name, body}: {name: string; body: string}): string[] {
  const errors: string[] = []
  const lines = body.split('\n')
  const firstContent = lines.find(line => line.trim() !== '')
  if (!firstContent?.startsWith('### ')) {
    errors.push(`${name}: entry must start with a "### type(scope): description" heading`)
  }
  let inFence = false
  for (const line of lines) {
    if (isFenceDelimiter(line)) inFence = !inFence
    if (!inFence && /^##? /u.test(line)) {
      errors.push(`${name}: h1/h2 headings are reserved for the monthly files ("${line.trim()}")`)
      break
    }
  }
  return errors
}

export function parseMonthFile({
  month,
  content,
}: {
  month: string
  content: string | null
}): MonthDoc {
  if (content === null) return {header: `# ${month}`, days: []}
  const headerLines: string[] = []
  const days: DaySection[] = []
  let currentDate: string | null = null
  let currentLines: string[] = []
  let inFence = false
  const flush = () => {
    if (currentDate !== null) days.push({date: currentDate, entries: currentLines.join('\n').trim()})
  }
  for (const line of content.split('\n')) {
    if (isFenceDelimiter(line)) inFence = !inFence
    if (!inFence && line.startsWith('## ')) {
      flush()
      currentDate = line.slice(3).trim()
      currentLines = []
    } else if (currentDate !== null) {
      currentLines.push(line)
    } else {
      headerLines.push(line)
    }
  }
  flush()
  return {header: headerLines.join('\n').trim(), days}
}

export function renderMonthFile(doc: MonthDoc): string {
  const blocks = [doc.header]
  for (const day of doc.days) {
    blocks.push(`## ${day.date}`, day.entries)
  }
  return `${blocks.join('\n\n')}\n`
}

export function foldFragments({doc, fragments}: {doc: MonthDoc; fragments: Fragment[]}): MonthDoc {
  const days = doc.days.map(day => ({...day}))
  const sorted = fragments.toSorted((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const fragment of sorted) {
    const existing = days.find(day => day.date === fragment.date)
    if (existing) {
      existing.entries = existing.entries
        ? `${existing.entries}\n\n${fragment.body}`
        : fragment.body
    } else {
      days.push({date: fragment.date, entries: fragment.body})
    }
  }
  return {header: doc.header, days: days.toSorted((a, b) => b.date.localeCompare(a.date, 'en'))}
}

export function updateFilesList({readme, months}: {readme: string; months: string[]}): string {
  const lines = readme.split('\n')
  const start = lines.indexOf('## Files')
  if (start === -1) return readme
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  const list = months
    .toSorted((a, b) => b.localeCompare(a, 'en'))
    .map(month => `- [${month}.md](./${month}.md)`)
  return [...lines.slice(0, start), '## Files', '', ...list, '', ...lines.slice(end)].join('\n')
}

async function readFragments(fragmentsDir: string): Promise<Fragment[]> {
  let names: string[]
  try {
    names = await readdir(fragmentsDir)
  } catch {
    return []
  }
  const errors: string[] = []
  const fragments: Fragment[] = []
  for (const name of names.toSorted()) {
    if (name === 'README.md' || name.startsWith('.')) continue
    const parsed = parseFragmentName(name)
    if (!parsed) {
      errors.push(
        `${name}: fragments must be named YYYY-MM-DD-<type>-<scope>-<short-slug>.md ` +
          '(lowercase kebab-case, real date)',
      )
      continue
    }
    const body = (await Bun.file(join(fragmentsDir, name)).text()).trim()
    if (body === '') {
      errors.push(`${name}: fragment is empty`)
      continue
    }
    errors.push(...validateFragmentBody({name, body}))
    fragments.push({name, ...parsed, body})
  }
  if (errors.length > 0) throw new Error(errors.join('\n'))
  return fragments
}

async function refreshFilesList(changelogDir: string): Promise<void> {
  const readmeFile = Bun.file(join(changelogDir, 'README.md'))
  if (!(await readmeFile.exists())) return
  const names = await readdir(changelogDir)
  const months = names
    .filter(name => /^\d{4}-\d{2}\.md$/u.test(name))
    .map(name => name.slice(0, -3))
  const readme = await readmeFile.text()
  const updated = updateFilesList({readme, months})
  if (updated !== readme) await Bun.write(join(changelogDir, 'README.md'), updated)
}

export async function rollupChangelog({
  changelogDir,
}: {
  changelogDir: string
}): Promise<RollupResult> {
  const fragmentsDir = join(changelogDir, 'fragments')
  const fragments = await readFragments(fragmentsDir)
  if (fragments.length === 0) return {folded: 0, months: []}

  const months = [...new Set(fragments.map(fragment => fragment.month))].toSorted()
  for (const month of months) {
    const path = join(changelogDir, `${month}.md`)
    const file = Bun.file(path)
    const content = (await file.exists()) ? await file.text() : null
    const doc = parseMonthFile({month, content})
    const folded = foldFragments({
      doc,
      fragments: fragments.filter(fragment => fragment.month === month),
    })
    await Bun.write(path, renderMonthFile(folded))
  }
  for (const fragment of fragments) {
    await rm(join(fragmentsDir, fragment.name))
  }
  await refreshFilesList(changelogDir)
  return {folded: fragments.length, months}
}

if (import.meta.main) {
  const changelogDir = join(import.meta.dir, '..', 'docs', 'changelog')
  try {
    const result = await rollupChangelog({changelogDir})
    if (result.folded === 0) {
      console.log('No fragments to roll up.')
    } else {
      console.log(`Folded ${result.folded} fragment(s) into: ${result.months.join(', ')}`)
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
