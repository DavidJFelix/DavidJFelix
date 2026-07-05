import {dirname, join, normalize} from 'node:path'
import ts from 'typescript'

/**
 * A module is the unit of the graph: a runtime `.js` file plus its paired
 * `.d.ts`, keyed by the runtime path relative to the package root.
 */
export interface ModuleInfo {
  runtimePath: string
  typesPath?: string
  /** Runtime paths of other modules in this package that this module imports. */
  internalImports: Set<string>
  /** Bare specifiers (external npm/JSR dependencies). */
  externalImports: Set<string>
  /** True when the module re-exports others but declares nothing of its own (a barrel). */
  isBarrel: boolean
}

export interface ModuleGraph {
  modules: Map<string, ModuleInfo>
}

export interface SourceFile {
  path: string
  text: string
}

const jsTranspiler = new Bun.Transpiler({loader: 'js'})

/** Extract import/re-export specifiers plus own-export names from a runtime JS module. */
export function scanRuntimeModule(text: string): {specifiers: string[]; ownExports: string[]} {
  const scan = jsTranspiler.scan(text)
  return {specifiers: scan.imports.map((i) => i.path), ownExports: scan.exports}
}

/**
 * Extract import specifiers from a `.d.ts` file. Uses the TypeScript scanner
 * because Bun's transpiler erases type-only imports before reporting them.
 */
export function scanTypesModule(text: string): string[] {
  return ts.preProcessFile(text, true, false).importedFiles.map((f) => f.fileName)
}

/** Resolve a relative specifier against the importing file's package-relative path. */
export function resolveRelative(importerPath: string, specifier: string): string {
  return normalize(join(dirname(importerPath), specifier))
}

/**
 * Build the module graph for a package from its files. `runtimeToTypes` pairs
 * runtime paths with their declaration files (derived from the exports map,
 * with a `_dist/` mirror fallback for unexported internals).
 */
export function buildModuleGraph(
  files: SourceFile[],
  runtimeToTypes: Map<string, string>,
): ModuleGraph {
  const byPath = new Map(files.map((f) => [normalize(f.path), f]))
  const runtimePaths = [...byPath.keys()].filter((p) => p.endsWith('.js'))
  const typesToRuntime = new Map([...runtimeToTypes].map(([rt, ty]) => [normalize(ty), rt]))

  const modules = new Map<string, ModuleInfo>()
  for (const runtimePath of runtimePaths) {
    const typesPath = runtimeToTypes.get(runtimePath)
    const info: ModuleInfo = {
      runtimePath,
      typesPath,
      internalImports: new Set(),
      externalImports: new Set(),
      isBarrel: false,
    }

    const runtimeText = byPath.get(runtimePath)?.text ?? ''
    const {specifiers, ownExports} = scanRuntimeModule(runtimeText)
    const typesText = typesPath ? byPath.get(normalize(typesPath))?.text : undefined
    const typeSpecifiers = typesText === undefined ? [] : scanTypesModule(typesText)

    const addSpecifier = (importerPath: string, specifier: string) => {
      if (!specifier.startsWith('.')) {
        info.externalImports.add(specifier)
        return
      }
      const resolved = resolveRelative(importerPath, specifier)
      const target = byPath.has(resolved)
        ? (typesToRuntime.get(resolved) ?? resolved)
        : resolveCandidate(resolved, byPath, typesToRuntime)
      // A .d.ts with no runtime pair is not a module; edges to it would create
      // phantom graph nodes that distort ownership and sharing.
      if (target !== undefined && target.endsWith('.js') && target !== runtimePath) {
        info.internalImports.add(target)
      }
    }

    for (const specifier of specifiers) addSpecifier(runtimePath, specifier)
    for (const specifier of typeSpecifiers) addSpecifier(typesPath as string, specifier)

    info.isBarrel = ownExports.length === 0 && info.internalImports.size >= 2
    modules.set(runtimePath, info)
  }
  return {modules}
}

/** Try extension-completion for specifiers written without one (`./foo` -> `./foo.js`). */
function resolveCandidate(
  resolved: string,
  byPath: Map<string, SourceFile>,
  typesToRuntime: Map<string, string>,
): string | undefined {
  for (const suffix of ['.js', '/index.js', '.d.ts']) {
    const candidate = normalize(resolved + suffix)
    if (byPath.has(candidate)) return typesToRuntime.get(candidate) ?? candidate
  }
  return undefined
}
