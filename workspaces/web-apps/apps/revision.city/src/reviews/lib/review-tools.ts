import {z} from 'zod'
import type {CodeEntity, EntityRange} from '../../symbols/lib/entity'
import {extractEntities} from '../../symbols/lib/extract-entities'
import {detectLanguage} from '../../symbols/lib/language-registry'
import type {ToolCall, ToolDefinition} from './openrouter'
import {type FileRead, type RepositorySnapshot, recordFileRead} from './repository-snapshot'

export interface ToolOutput {
  content: string
  read?: FileRead
}

export interface ReviewTools {
  definitions: readonly ToolDefinition[]
  run: (call: ToolCall) => Promise<ToolOutput>
}

const MAX_FILE_BYTES = 1_000_000
const MAX_LINES_PER_READ = 300
const MAX_LINE_LENGTH = 400
const MAX_DIRECTORY_ENTRIES = 200
const MAX_DEFINITIONS = 3
const MAX_DEFINITION_LINES = 200
const MAX_LISTED_NAMES = 60
const MAX_NAME_LENGTH = 200

const pathProperty = {type: 'string', description: 'Path from the repository root'}

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'read_file',
    description: `Read lines of a file at the pull request head, at most ${MAX_LINES_PER_READ} lines per call. Each line starts with "L" and its line number in the file. The tool cuts a line over ${MAX_LINE_LENGTH} characters and ends it with "...".`,
    parameters: {
      type: 'object',
      properties: {
        path: pathProperty,
        start_line: {type: 'integer', minimum: 1, description: 'First line to read. Default: 1.'},
        end_line: {type: 'integer', minimum: 1, description: 'Last line to read.'},
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_directory',
    description:
      'List the files and directories in a directory at the pull request head. Directory names end with "/".',
    parameters: {
      type: 'object',
      properties: {
        path: {type: 'string', description: 'Path from the repository root. "" is the root.'},
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_definition',
    description:
      'Read the definition of a function, class, type, or other named item in a file at the pull request head. The tool shows each line as read_file does.',
    parameters: {
      type: 'object',
      properties: {
        path: pathProperty,
        name: {type: 'string', description: 'The name, or a dotted name such as "Widget.render".'},
      },
      required: ['path', 'name'],
      additionalProperties: false,
    },
  },
]

const readFileArgumentsSchema = z
  .object({
    path: z.string(),
    start_line: z.int().positive().optional(),
    end_line: z.int().positive().optional(),
  })
  .refine(({start_line = 1, end_line}) => end_line === undefined || end_line >= start_line, {
    error: 'end_line is before start_line',
    path: ['end_line'],
  })

const listDirectoryArgumentsSchema = z.object({path: z.string()})

const readDefinitionArgumentsSchema = z.object({path: z.string(), name: z.string().min(1)})

export function createReviewTools(snapshot: RepositorySnapshot): ReviewTools {
  return {
    definitions: TOOL_DEFINITIONS,
    run: async (call) => {
      const parsedArguments = parseArguments(call.arguments)
      switch (call.name) {
        case 'read_file': {
          const parsed = readFileArgumentsSchema.safeParse(parsedArguments)
          return parsed.success
            ? readFile({
                snapshot,
                path: normalizePath(parsed.data.path),
                startLine: parsed.data.start_line ?? 1,
                endLine: parsed.data.end_line,
              })
            : invalidArguments(call.name, parsed.error)
        }
        case 'list_directory': {
          const parsed = listDirectoryArgumentsSchema.safeParse(parsedArguments)
          return parsed.success
            ? listDirectory({snapshot, path: normalizePath(parsed.data.path)})
            : invalidArguments(call.name, parsed.error)
        }
        case 'read_definition': {
          const parsed = readDefinitionArgumentsSchema.safeParse(parsedArguments)
          return parsed.success
            ? readDefinition({
                snapshot,
                path: normalizePath(parsed.data.path),
                name: parsed.data.name,
              })
            : invalidArguments(call.name, parsed.error)
        }
        default:
          return {content: `There is no tool named ${call.name}.`}
      }
    },
  }
}

function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function invalidArguments(name: string, error: z.ZodError): ToolOutput {
  return {content: `Invalid arguments for ${name}: ${z.prettifyError(error)}`}
}

// Models write paths as "/src/a.ts", "./src/a.ts", or "src/" as often as "src/a.ts".
export function normalizePath(path: string): string {
  const trimmed = path
    .trim()
    .replace(/^(?:\.?\/)+/, '')
    .replace(/\/+$/, '')
  return trimmed === '.' ? '' : trimmed
}

interface SnapshotPathParams {
  snapshot: RepositorySnapshot
  path: string
}

type TextFile = {text: string; read: FileRead} | {error: string; read: FileRead}

async function readText({snapshot, path}: SnapshotPathParams): Promise<TextFile> {
  const entry = snapshot.entries.get(path)
  const read = recordFileRead({snapshot, path})
  if (entry === undefined) {
    return {error: `${path} does not exist at the pull request head.`, read}
  }
  if (entry.type !== 'blob') {
    return {error: `${path} is a ${entry.type === 'tree' ? 'directory' : 'submodule'}.`, read}
  }
  if (entry.sizeBytes !== undefined && entry.sizeBytes > MAX_FILE_BYTES) {
    return {error: tooLarge(path, entry.sizeBytes), read}
  }
  const bytes = await snapshot.readBlob(entry.sha)
  // The tree can leave out the size, so the limit also applies to the bytes.
  if (bytes.length > MAX_FILE_BYTES) {
    return {error: tooLarge(path, bytes.length), read}
  }
  const text = decodeText(bytes)
  return text === undefined ? {error: `${path} is a binary file.`, read} : {text, read}
}

function tooLarge(path: string, sizeBytes: number): string {
  return `${path} is too large to read (${sizeBytes} bytes).`
}

function decodeText(bytes: Uint8Array): string | undefined {
  try {
    const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes)
    return text.includes('\0') ? undefined : text
  } catch {
    return undefined
  }
}

function splitLines(text: string): string[] {
  const lines = text.split('\n')
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines
}

function numberLine(line: string, lineNumber: number): string {
  return `L${lineNumber}: ${clip(line, MAX_LINE_LENGTH)}`
}

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${cutText(text, maxLength)}...`
}

// Some model APIs refuse a request with half of a surrogate pair in it. If a
// cut would split a pair, the text ends before the pair.
export function cutText(text: string, maxLength: number): string {
  const end = isHighSurrogate(text.charCodeAt(maxLength - 1)) ? maxLength - 1 : maxLength
  return text.slice(0, end)
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

interface ReadFileParams extends SnapshotPathParams {
  startLine: number
  endLine?: number
}

async function readFile({snapshot, path, startLine, endLine}: ReadFileParams): Promise<ToolOutput> {
  const file = await readText({snapshot, path})
  if ('error' in file) {
    return {content: file.error, read: file.read}
  }
  const lines = splitLines(file.text)
  if (startLine > lines.length) {
    return {content: `${path} has ${lines.length} lines.`, read: file.read}
  }
  const lastLine = Math.min(
    endLine ?? lines.length,
    startLine + MAX_LINES_PER_READ - 1,
    lines.length,
  )
  const shown = lines
    .slice(startLine - 1, lastLine)
    .map((line, index) => numberLine(line, startLine + index))
  const notShown = lastLine < lines.length ? [`(${lines.length - lastLine} more lines.)`] : []
  return {
    content: [
      `${path}, lines ${startLine}-${lastLine} of ${lines.length}:`,
      ...shown,
      ...notShown,
    ].join('\n'),
    read: file.read,
  }
}

function listDirectory({snapshot, path}: SnapshotPathParams): ToolOutput {
  const entry = snapshot.entries.get(path)
  const read = recordFileRead({snapshot, path})
  if (entry?.type !== 'tree') {
    const problem =
      entry === undefined ? 'does not exist at the pull request head' : 'is not a directory'
    return {content: `${path} ${problem}.`, read}
  }
  const prefix = path === '' ? '' : `${path}/`
  const names = [...snapshot.entries]
    .filter(
      ([entryPath]) =>
        entryPath.startsWith(prefix) &&
        entryPath !== path &&
        !entryPath.slice(prefix.length).includes('/'),
    )
    .map(
      ([entryPath, child]) =>
        `${entryPath.slice(prefix.length)}${child.type === 'tree' ? '/' : ''}`,
    )
  const notShown =
    names.length > MAX_DIRECTORY_ENTRIES
      ? [`(${names.length - MAX_DIRECTORY_ENTRIES} more entries.)`]
      : []
  return {
    content: [
      `${path === '' ? '/' : path}:`,
      ...names.slice(0, MAX_DIRECTORY_ENTRIES),
      ...notShown,
    ].join('\n'),
    read,
  }
}

interface ReadDefinitionParams extends SnapshotPathParams {
  name: string
}

async function readDefinition({snapshot, path, name}: ReadDefinitionParams): Promise<ToolOutput> {
  const file = await readText({snapshot, path})
  if ('error' in file) {
    return {content: file.error, read: file.read}
  }
  const language = detectLanguage(path)
  if (language === undefined) {
    return {content: `read_definition does not support ${path}. Use read_file.`, read: file.read}
  }
  const extraction = extractEntities({source: file.text, parser: await language.loadParser()})
  if (extraction.tooLarge) {
    return {content: `${path} is too large for read_definition. Use read_file.`, read: file.read}
  }
  const {entities} = extraction
  const matches = entities.filter((entity) => entity.name === name || entity.qualifiedName === name)
  if (matches.length === 0) {
    const names = [
      ...new Set(entities.map((entity) => clip(entity.qualifiedName, MAX_NAME_LENGTH))),
    ]
    return {
      content: `${path} has no definition named "${name}". Names in the file: ${names.slice(0, MAX_LISTED_NAMES).join(', ')}`,
      read: file.read,
    }
  }
  const lines = splitLines(file.text)
  const sections = matches.slice(0, MAX_DEFINITIONS).map((entity) => {
    const {startLine, endLine} = definitionLines(entity, file.text)
    const lastLine = Math.min(endLine, startLine + MAX_DEFINITION_LINES - 1)
    const shown = lines
      .slice(startLine - 1, lastLine)
      .map((line, index) => numberLine(line, startLine + index))
    const notShown = lastLine < endLine ? [`(${endLine - lastLine} more lines.)`] : []
    return [
      `${path}: ${entity.kind} ${clip(entity.qualifiedName, MAX_NAME_LENGTH)}, lines ${startLine}-${endLine}:`,
      ...shown,
      ...notShown,
    ].join('\n')
  })
  const others = matches.slice(MAX_DEFINITIONS).map((entity) => {
    const {startLine, endLine} = definitionLines(entity, file.text)
    return `${clip(entity.qualifiedName, MAX_NAME_LENGTH)} at lines ${startLine}-${endLine}`
  })
  const othersNotShown =
    others.length === 0
      ? []
      : [`(${others.length} more: ${others.slice(0, MAX_LISTED_NAMES).join(', ')}.)`]
  return {content: [...sections, ...othersNotShown].join('\n\n'), read: file.read}
}

// The node of a definition can end with its line break. Then the node ends at
// the start of the next line, which is not part of the definition.
function definitionLines({range, span}: CodeEntity, text: string): EntityRange {
  return {
    startLine: range.startLine,
    endLine: text[span.to - 1] === '\n' ? range.endLine - 1 : range.endLine,
  }
}
