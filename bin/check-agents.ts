#!/usr/bin/env bun
// Verify the agent-persona artifact class: every solid persona in
// .agents/agents/ carries strict-YAML frontmatter whose name matches its
// filename and a non-empty description, and .claude/agents/ mirrors the solid
// copies bidirectionally -- one resolving file symlink per persona, no regular
// files, no directory links. Claude Code tolerates frontmatter that stricter
// parsers reject, and a flattened symlink still "works" locally, so both
// defect classes regress silently without this gate.
//
// Entry point: `mise run check:agents`.

import {existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'

export interface CheckPersonaParams {
  file: string
  text: string
}

export function checkPersona({file, text}: CheckPersonaParams): string[] {
  if (!text.startsWith('---\n')) return [`${file}: missing frontmatter block`]
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return [`${file}: unterminated frontmatter block`]
  let data: unknown
  try {
    data = Bun.YAML.parse(text.slice(4, end))
  } catch (error) {
    return [`${file}: frontmatter is not strict YAML -- ${error}`]
  }
  const frontmatter = data as Record<string, unknown>
  const findings: string[] = []
  const expected = basename(file, '.md')
  if (frontmatter.name !== expected) {
    findings.push(`${file}: frontmatter name "${frontmatter.name}" does not match filename "${expected}"`)
  }
  if (typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
    findings.push(`${file}: missing or empty description`)
  }
  return findings
}

export interface CheckMirrorParams {
  solidDir: string
  linkDir: string
}

export function checkMirror({solidDir, linkDir}: CheckMirrorParams): string[] {
  const findings: string[] = []
  if (lstatSync(linkDir).isSymbolicLink()) {
    return [`${linkDir}: is itself a symlink -- link files individually, never the directory`]
  }
  const solids = readdirSync(solidDir).filter(name => name.endsWith('.md'))
  const links = readdirSync(linkDir)
  for (const name of solids) {
    if (!links.includes(name)) findings.push(`${join(linkDir, name)}: missing symlink for solid persona`)
  }
  for (const name of links) {
    const link = join(linkDir, name)
    if (!lstatSync(link).isSymbolicLink()) {
      findings.push(`${link}: not a symlink -- solid copies live in ${solidDir}`)
      continue
    }
    const target = resolve(linkDir, readlinkSync(link))
    const expected = join(solidDir, name)
    if (target !== expected) {
      findings.push(`${link}: points at ${target}, expected ${expected}`)
    } else if (!existsSync(target)) {
      findings.push(`${link}: dangling -- target ${target} does not exist`)
    } else if (!statSync(target).isFile()) {
      findings.push(`${link}: target ${target} is not a file`)
    }
  }
  return findings
}

if (import.meta.main) {
  const repoRoot = resolve(import.meta.dir, '..')
  const solidDir = join(repoRoot, '.agents/agents')
  const linkDir = join(repoRoot, '.claude/agents')
  const personas = readdirSync(solidDir).filter(name => name.endsWith('.md'))
  const findings = [
    ...personas.flatMap(name =>
      checkPersona({
        file: join('.agents/agents', name),
        text: readFileSync(join(solidDir, name), 'utf8'),
      }),
    ),
    ...checkMirror({solidDir, linkDir}),
  ]
  if (findings.length > 0) {
    console.error(`check-agents: ${findings.length} finding(s)`)
    for (const finding of findings) console.error(`  ${finding}`)
    process.exit(1)
  }
  console.log(`check-agents: ok -- ${personas.length} personas, mirror intact`)
}
