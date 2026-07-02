import type {ModuleGraph} from './module-graph.ts'

export interface EntryPaths {
  runtime: string
  types?: string
}

export interface DecomposeInput {
  graph: ModuleGraph
  /** Normalized exports map: subpath (`.` / `./chunk`) -> package-relative paths. */
  exports: Map<string, EntryPaths>
  upstream: {jsrName: string; version: string}
  /** npm scope the parts are published under. */
  scope?: string
}

export interface Part {
  name: string
  kind: 'export' | 'internal'
  /** Original upstream subpaths served by this part (empty for internal parts). */
  subpaths: string[]
  /** Runtime paths of member modules. */
  modules: string[]
  /** Names of other parts this part depends on. */
  partDeps: string[]
  /** Bare external specifiers imported by member modules. */
  externals: string[]
  /** Part-relative export subpath -> module paths. */
  exportsMap: Record<string, EntryPaths>
}

export interface DecomposePlan {
  parts: Part[]
  skipped: {subpath: string; reason: string}[]
  /** Runtime path -> name of the part that owns it. */
  moduleToPart: Record<string, string>
  /** Runtime path -> specifier other parts use to import it. */
  moduleSpecifier: Record<string, string>
}

/**
 * Split a package's module graph into independently publishable parts.
 *
 * Each non-barrel export subpath becomes a part owning its entry module and
 * the internals only it reaches. Imports of another part's entry become real
 * package dependencies instead of bundled copies; mutually-cyclic entries
 * merge into one part; internals reached by several parts move to shared
 * `--internal-*` parts. Barrel entries (re-export-only aggregators, like a
 * root `mod.js`) are skipped -- they are the thing being decomposed.
 */
export function planDecomposition(input: DecomposeInput): DecomposePlan {
  const {graph, exports: exportsMap, upstream} = input
  const scope = input.scope ?? '@pkgdog'
  const base = sanitizeBase(upstream.jsrName)
  const skipped: DecomposePlan['skipped'] = []

  const entries: {subpath: string; paths: EntryPaths}[] = []
  for (const [subpath, paths] of exportsMap) {
    const mod = graph.modules.get(paths.runtime)
    if (!mod) {
      skipped.push({subpath, reason: `entry module ${paths.runtime} not found`})
    } else if (mod.isBarrel) {
      skipped.push({subpath, reason: 'barrel (re-export aggregator)'})
    } else {
      entries.push({subpath, paths})
    }
  }

  const reach = new Map<string, Set<string>>()
  for (const {paths} of entries) reach.set(paths.runtime, reachableFrom(graph, paths.runtime))

  const groups = mergeCyclicEntries(entries, reach)

  const entryModuleToGroup = new Map<string, number>()
  groups.forEach((group, index) => {
    for (const entry of group) entryModuleToGroup.set(entry.paths.runtime, index)
  })

  const closures = groups.map((group, index) =>
    boundaryStoppedClosure(
      graph,
      group.map((e) => e.paths.runtime),
      (m) => entryModuleToGroup.has(m) && entryModuleToGroup.get(m) !== index,
    ),
  )

  const owners = new Map<string, number[]>()
  closures.forEach(({included}, index) => {
    for (const m of included) owners.set(m, [...(owners.get(m) ?? []), index])
  })
  const shared = new Set([...owners].filter(([, o]) => o.length > 1).map(([m]) => m))

  const internalGroups = connectedComponents(graph, shared)

  const groupPartName = groups.map((group) => {
    const slugs = group
      .map((e) => subpathSlug(e.subpath))
      .toSorted((a, b) => a.localeCompare(b, 'en'))
    const joined = slugs.join('--')
    const slug = joined.length <= 80 ? joined : `${slugs[0]}--and-${String(slugs.length - 1)}-more`
    return `${scope}/${base}--${slug}`
  })
  const internalPartName = internalGroups.map((modules) => {
    const first = modules.toSorted((a, b) => a.localeCompare(b, 'en'))[0] as string
    return `${scope}/${base}--internal-${moduleSlug(first)}`
  })

  const moduleToPart: Record<string, string> = {}
  const moduleSpecifier: Record<string, string> = {}
  groups.forEach((group, index) => {
    const name = groupPartName[index] as string
    for (const entry of group) {
      moduleToPart[entry.paths.runtime] = name
      moduleSpecifier[entry.paths.runtime] =
        group.length === 1 ? name : `${name}${entry.subpath.slice(1)}`
    }
  })
  internalGroups.forEach((modules, index) => {
    const name = internalPartName[index] as string
    for (const m of modules) {
      moduleToPart[m] = name
      moduleSpecifier[m] = `${name}/${moduleSlug(m)}`
    }
  })

  const parts: Part[] = []
  groups.forEach((group, index) => {
    const name = groupPartName[index] as string
    const closure = closures[index] as ReturnType<typeof boundaryStoppedClosure>
    const modules = [...closure.included].filter(
      (m) => !shared.has(m) || entryModuleToGroup.get(m) === index,
    )
    for (const m of modules) moduleToPart[m] ??= name
    const exportsOut: Record<string, EntryPaths> = {}
    if (group.length === 1) exportsOut['.'] = (group[0] as {paths: EntryPaths}).paths
    for (const entry of group) if (entry.subpath !== '.') exportsOut[entry.subpath] = entry.paths
    parts.push({
      name,
      kind: 'export',
      subpaths: group.map((e) => e.subpath).toSorted((a, b) => a.localeCompare(b, 'en')),
      modules: modules.toSorted((a, b) => a.localeCompare(b, 'en')),
      partDeps: partDepsOf(graph, modules, name, moduleToPart, closure.boundaries),
      externals: externalsOf(graph, modules),
      exportsMap: exportsOut,
    })
  })
  internalGroups.forEach((modules, index) => {
    const name = internalPartName[index] as string
    const exportsOut: Record<string, EntryPaths> = {}
    for (const m of modules) {
      const info = graph.modules.get(m)
      exportsOut[`./${moduleSlug(m)}`] = {runtime: m, types: info?.typesPath}
    }
    parts.push({
      name,
      kind: 'internal',
      subpaths: [],
      modules: modules.toSorted((a, b) => a.localeCompare(b, 'en')),
      partDeps: partDepsOf(graph, modules, name, moduleToPart, new Set()),
      externals: externalsOf(graph, modules),
      exportsMap: exportsOut,
    })
  })

  const sortedParts = parts.toSorted((a, b) => a.name.localeCompare(b.name, 'en'))
  return {parts: sortedParts, skipped, moduleToPart, moduleSpecifier}
}

/** `@std/collections` -> `std-collections` */
export function sanitizeBase(jsrName: string): string {
  return jsrName.replace(/^@/u, '').replaceAll('/', '-').replaceAll('_', '-')
}

/** `.` -> `root`, `./drop-while` -> `drop-while` */
export function subpathSlug(subpath: string): string {
  if (subpath === '.') return 'root'
  return subpath.replace(/^\.\//u, '').replaceAll('/', '-').replaceAll('_', '-')
}

/** `_dist/map_entries.js` -> `map-entries` */
export function moduleSlug(runtimePath: string): string {
  const stem = (runtimePath.split('/').at(-1) as string).replace(/\.js$/u, '')
  return stem.replaceAll('_', '-').replace(/^-+/u, '')
}

function reachableFrom(graph: ModuleGraph, start: string): Set<string> {
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const next of graph.modules.get(current)?.internalImports ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return seen
}

type Entry = {subpath: string; paths: EntryPaths}

/** Group entries, merging any pair of entries that can reach each other. */
function mergeCyclicEntries(entries: Entry[], reach: Map<string, Set<string>>): Entry[][] {
  const parent = entries.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] as number
    return i
  }
  for (let a = 0; a < entries.length; a++) {
    for (let b = a + 1; b < entries.length; b++) {
      const moduleA = (entries[a] as Entry).paths.runtime
      const moduleB = (entries[b] as Entry).paths.runtime
      const cyclic =
        moduleA === moduleB ||
        (reach.get(moduleA)?.has(moduleB) === true && reach.get(moduleB)?.has(moduleA) === true)
      if (cyclic) parent[find(b)] = find(a)
    }
  }
  const byRoot = new Map<number, Entry[]>()
  entries.forEach((entry, i) => {
    const root = find(i)
    byRoot.set(root, [...(byRoot.get(root) ?? []), entry])
  })
  return [...byRoot.values()]
}

/**
 * Transitive closure from the group's entries that does not traverse through
 * other groups' entry modules -- those become dependency boundaries instead.
 */
function boundaryStoppedClosure(
  graph: ModuleGraph,
  starts: string[],
  isBoundary: (m: string) => boolean,
): {included: Set<string>; boundaries: Set<string>} {
  const included = new Set(starts)
  const boundaries = new Set<string>()
  const stack = [...starts]
  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const next of graph.modules.get(current)?.internalImports ?? []) {
      if (isBoundary(next)) {
        boundaries.add(next)
      } else if (!included.has(next)) {
        included.add(next)
        stack.push(next)
      }
    }
  }
  return {included, boundaries}
}

/** Undirected connected components restricted to the given module subset. */
function connectedComponents(graph: ModuleGraph, subset: Set<string>): string[][] {
  const undirected = new Map<string, Set<string>>()
  for (const m of subset) undirected.set(m, new Set())
  for (const m of subset) {
    for (const target of graph.modules.get(m)?.internalImports ?? []) {
      if (subset.has(target)) {
        undirected.get(m)?.add(target)
        undirected.get(target)?.add(m)
      }
    }
  }
  const seen = new Set<string>()
  const components: string[][] = []
  for (const start of subset) {
    if (seen.has(start)) continue
    const component: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      const current = stack.pop() as string
      component.push(current)
      for (const next of undirected.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          stack.push(next)
        }
      }
    }
    components.push(component)
  }
  return components
}

function partDepsOf(
  graph: ModuleGraph,
  modules: string[],
  selfName: string,
  moduleToPart: Record<string, string>,
  boundaries: Set<string>,
): string[] {
  const deps = new Set<string>()
  for (const boundary of boundaries) {
    const part = moduleToPart[boundary]
    if (part !== undefined && part !== selfName) deps.add(part)
  }
  for (const m of modules) {
    for (const target of graph.modules.get(m)?.internalImports ?? []) {
      const part = moduleToPart[target]
      if (part !== undefined && part !== selfName) deps.add(part)
    }
  }
  return [...deps].toSorted((a, b) => a.localeCompare(b, 'en'))
}

function externalsOf(graph: ModuleGraph, modules: string[]): string[] {
  const externals = new Set<string>()
  for (const m of modules) {
    for (const spec of graph.modules.get(m)?.externalImports ?? []) externals.add(spec)
  }
  return [...externals].toSorted((a, b) => a.localeCompare(b, 'en'))
}
