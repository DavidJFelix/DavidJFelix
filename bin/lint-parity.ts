#!/usr/bin/env bun
// Proves the Biome -> oxlint/oxfmt migration kept every previously-active lint
// rule enforced. Each file in .config/lint-parity/fixtures/ violates exactly one
// rule from the Biome 2.5 recommended set that was active in this repo, and
// .config/lint-parity/manifest.json records which engine must catch it now:
// "oxlint" entries expect an oxlint rule code (e.g. "eslint(no-var)"), "biome"
// entries expect a Biome diagnostic category (e.g. "lint/correctness/noUnknownUnit").
// Run via `mise run lint:parity`; CI runs it from ci-repo.yml.

type ManifestEntry = {
  file: string
  engine: 'oxlint' | 'biome'
  expect: string
}

type Manifest = Record<string, ManifestEntry>

// code is null for oxc parser/semantic errors (still coverage: the file is
// rejected outright); the runner buckets those under 'oxc-syntax-error'
type OxlintDiagnostic = {
  filename: string
  code: string | null
}

type BiomeDiagnostic = {
  category: string | null
  location: {path?: {file?: string} | string | null}
}

const FIXTURES_DIR = '.config/lint-parity/fixtures'
const MANIFEST_PATH = '.config/lint-parity/manifest.json'

export const fixtureName = (path: string): string => {
  const normalized = path.replaceAll('\\', '/')
  const marker = 'fixtures/'
  const index = normalized.lastIndexOf(marker)
  return index === -1 ? normalized : normalized.slice(index + marker.length)
}

export type FiredByFile = Map<string, Set<string>>

export const collectOxlintFired = (diagnostics: Array<OxlintDiagnostic>): FiredByFile => {
  const fired: FiredByFile = new Map()
  for (const diagnostic of diagnostics) {
    const file = fixtureName(diagnostic.filename)
    if (!fired.has(file)) fired.set(file, new Set())
    fired.get(file)?.add(diagnostic.code ?? 'oxc-syntax-error')
  }
  return fired
}

export const collectBiomeFired = (diagnostics: Array<BiomeDiagnostic>): FiredByFile => {
  const fired: FiredByFile = new Map()
  for (const diagnostic of diagnostics) {
    const path = diagnostic.location.path
    const file = typeof path === 'string' ? path : path?.file
    if (!file || !diagnostic.category) continue
    const name = fixtureName(file)
    if (!fired.has(name)) fired.set(name, new Set())
    fired.get(name)?.add(diagnostic.category)
  }
  return fired
}

export const findMisses = (
  manifest: Manifest,
  firedByEngine: {oxlint: FiredByFile; biome: FiredByFile},
): Array<{rule: string; entry: ManifestEntry}> =>
  Object.entries(manifest)
    .filter(([, entry]) => !firedByEngine[entry.engine].get(entry.file)?.has(entry.expect))
    .map(([rule, entry]) => ({rule, entry}))

const runCapture = async (cmd: Array<string>): Promise<string> => {
  const proc = Bun.spawn(cmd, {stdout: 'pipe', stderr: 'pipe'})
  const stdout = await new Response(proc.stdout).text()
  await proc.exited
  return stdout
}

if (import.meta.main) {
  const manifest: Manifest = await Bun.file(MANIFEST_PATH).json()

  const oxlintOut = await runCapture([
    'oxlint',
    '-c',
    '.oxlintrc.json',
    '--disable-nested-config',
    '--format=json',
    FIXTURES_DIR,
  ])
  const oxlintParsed = JSON.parse(oxlintOut)
  const oxlintDiagnostics: Array<OxlintDiagnostic> = Array.isArray(oxlintParsed)
    ? oxlintParsed
    : (oxlintParsed.diagnostics ?? [])

  const biomeOut = await runCapture([
    'biome',
    'check',
    '--reporter=json',
    '--max-diagnostics=2000',
    FIXTURES_DIR,
  ])
  const biomeDiagnostics: Array<BiomeDiagnostic> = JSON.parse(biomeOut).diagnostics ?? []

  const misses = findMisses(manifest, {
    oxlint: collectOxlintFired(oxlintDiagnostics),
    biome: collectBiomeFired(biomeDiagnostics),
  })

  const entries = Object.entries(manifest)
  const byEngine = {
    oxlint: entries.filter(([, entry]) => entry.engine === 'oxlint').length,
    biome: entries.filter(([, entry]) => entry.engine === 'biome').length,
  }
  console.log(
    `lint-parity: ${entries.length} rules (${byEngine.oxlint} oxlint, ${byEngine.biome} biome)`,
  )

  if (misses.length > 0) {
    console.error(`\n${misses.length} rule(s) no longer caught:`)
    for (const miss of misses) {
      console.error(
        `  ${miss.rule}: expected ${miss.entry.engine} to report ${miss.entry.expect} on ${miss.entry.file}`,
      )
    }
    process.exit(1)
  }
  console.log('all fixtures caught by their assigned engine')
}
