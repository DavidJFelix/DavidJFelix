import {z} from 'zod'
import {type GitHubRepository, type GitHubRequest, repositoryPath} from './github-api'

export type RepositoryEntry =
  | {type: 'blob'; sha: string; sizeBytes?: number}
  | {type: 'tree' | 'commit'; sha: string}

// Git object ids identify content, so a caller can tell later whether a file
// that it read changed.
export interface RepositorySnapshot {
  // Entries by path from the repository root. The root directory is ''.
  entries: ReadonlyMap<string, RepositoryEntry>
  readBlob: (sha: string) => Promise<Uint8Array>
}

export interface FileRead {
  path: string
  sha: string
}

// The id that a read records for a path that does not exist, so that a later
// file at that path counts as a change.
const MISSING_PATH_SHA = ''

export interface RecordFileReadParams {
  snapshot: RepositorySnapshot
  path: string
}

export function recordFileRead({snapshot, path}: RecordFileReadParams): FileRead {
  return {path, sha: snapshot.entries.get(path)?.sha ?? MISSING_PATH_SHA}
}

export interface LoadRepositorySnapshotParams {
  request: GitHubRequest
  repository: GitHubRepository
  commitSha: string
}

const treeSchema = z.object({
  sha: z.string(),
  truncated: z.boolean(),
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.enum(['blob', 'tree', 'commit']),
      sha: z.string(),
      size: z.number().optional(),
    }),
  ),
})

const blobSchema = z.object({content: z.string(), encoding: z.literal('base64')})

// If GitHub truncates the tree, a missing path does not prove that the file
// does not exist.
export async function loadRepositorySnapshot({
  request,
  repository,
  commitSha,
}: LoadRepositorySnapshotParams): Promise<RepositorySnapshot | undefined> {
  const tree = await request({
    path: `${repositoryPath(repository)}/git/trees/${encodeURIComponent(commitSha)}?recursive=1`,
    schema: treeSchema,
  })
  if (tree.truncated) {
    return undefined
  }
  const entries = new Map<string, RepositoryEntry>([['', {type: 'tree', sha: tree.sha}]])
  for (const {path, type, sha, size} of tree.tree) {
    entries.set(path, type === 'blob' ? {type, sha, sizeBytes: size} : {type, sha})
  }
  const blobs = new Map<string, Promise<Uint8Array>>()
  const readBlob = (sha: string): Promise<Uint8Array> => {
    const cached = blobs.get(sha)
    if (cached) {
      return cached
    }
    const loaded = request({
      path: `${repositoryPath(repository)}/git/blobs/${encodeURIComponent(sha)}`,
      schema: blobSchema,
    }).then(({content}) => Uint8Array.from(atob(content), toCharCode))
    // The catch removes a failed read from `blobs`, so that the next call tries
    // again.
    blobs.set(sha, loaded)
    loaded.catch(() => blobs.delete(sha))
    return loaded
  }
  return {entries, readBlob}
}

function toCharCode(character: string): number {
  return character.charCodeAt(0)
}

export function readsStillMatch(
  reads: readonly FileRead[],
  snapshot: RepositorySnapshot | undefined,
): boolean {
  return reads.every(
    (read) =>
      snapshot !== undefined && recordFileRead({snapshot, path: read.path}).sha === read.sha,
  )
}
