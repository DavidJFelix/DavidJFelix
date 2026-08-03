import type {Parser} from '@lezer/common'

export interface LanguageDefinition {
  readonly id: string
  readonly label: string
  readonly extensions: readonly string[]
  // Dynamic so a request pays only for the grammar it parses -- eagerly
  // importing all of them would load every parse table on worker cold start.
  readonly loadParser: () => Promise<Parser>
}

// Every first-party CodeMirror grammar that yields nameable entities. The
// remaining first-party grammars (html, xml, lezer) parse fine but have no
// entity vocabulary worth reporting in a review, so they are left out rather
// than shipped as empty results.
export const LANGUAGES: readonly LanguageDefinition[] = [
  {
    id: 'typescript',
    label: 'TypeScript',
    extensions: ['.ts', '.mts', '.cts'],
    loadParser: async () => (await import('./languages/javascript')).typescriptParser,
  },
  {
    id: 'tsx',
    label: 'TSX',
    extensions: ['.tsx'],
    loadParser: async () => (await import('./languages/javascript')).tsxParser,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    extensions: ['.js', '.mjs', '.cjs'],
    loadParser: async () => (await import('./languages/javascript')).javascriptParser,
  },
  {
    id: 'jsx',
    label: 'JSX',
    extensions: ['.jsx'],
    loadParser: async () => (await import('./languages/javascript')).jsxParser,
  },
  {
    id: 'python',
    label: 'Python',
    extensions: ['.py', '.pyi'],
    loadParser: async () => (await import('./languages/python')).pythonParser,
  },
  {
    id: 'rust',
    label: 'Rust',
    extensions: ['.rs'],
    loadParser: async () => (await import('./languages/rust')).rustParser,
  },
  {
    id: 'go',
    label: 'Go',
    extensions: ['.go'],
    loadParser: async () => (await import('./languages/go')).goParser,
  },
  {
    id: 'java',
    label: 'Java',
    extensions: ['.java'],
    loadParser: async () => (await import('./languages/java')).javaParser,
  },
  {
    id: 'cpp',
    label: 'C++',
    extensions: ['.c', '.h', '.cc', '.cpp', '.cxx', '.hh', '.hpp', '.hxx'],
    loadParser: async () => (await import('./languages/cpp')).cppParser,
  },
  {
    id: 'php',
    label: 'PHP',
    extensions: ['.php'],
    loadParser: async () => (await import('./languages/php')).phpParser,
  },
  {
    id: 'css',
    label: 'CSS',
    extensions: ['.css'],
    loadParser: async () => (await import('./languages/css')).cssParser,
  },
  {
    id: 'sass',
    label: 'Sass',
    extensions: ['.scss', '.sass'],
    loadParser: async () => (await import('./languages/css')).sassParser,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md', '.markdown', '.mdx'],
    loadParser: async () => (await import('./languages/markdown')).markdownParser,
  },
  {
    id: 'json',
    label: 'JSON',
    extensions: ['.json', '.jsonc'],
    loadParser: async () => (await import('./languages/structured')).jsonParser,
  },
  {
    id: 'yaml',
    label: 'YAML',
    extensions: ['.yaml', '.yml'],
    loadParser: async () => (await import('./languages/structured')).yamlParser,
  },
]

const BY_EXTENSION = new Map<string, LanguageDefinition>(
  LANGUAGES.flatMap((language) =>
    language.extensions.map((extension) => [extension, language] as const),
  ),
)

// Longest-suffix wins so `.d.ts` and `.test.tsx` resolve the same as their base
// extension, and a dotfile without an extension resolves to nothing.
export function detectLanguage(path: string): LanguageDefinition | undefined {
  const fileName = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) {
    return undefined
  }
  return BY_EXTENSION.get(fileName.slice(dot))
}
