import {z} from 'zod'
import type {Fetch} from './openrouter'
import type {PullRequestFile} from './review-chunks'

export interface GitHubRepository {
  owner: string
  name: string
}

export interface GitHubRequestParams<Result> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  // The path below https://api.github.com, with its query string.
  path: string
  body?: unknown
  schema: z.ZodType<Result>
}

export type GitHubRequest = <Result>(params: GitHubRequestParams<Result>) => Promise<Result>

export interface CreateGitHubRequestParams {
  // Absent for anonymous reads of public repositories.
  token?: () => Promise<string>
  fetch?: Fetch
}

const GITHUB_API_URL = 'https://api.github.com'

export class GitHubApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function createGitHubRequest({
  token,
  fetch: fetchImpl = fetch,
}: CreateGitHubRequestParams): GitHubRequest {
  return async ({method = 'GET', path, body, schema}) => {
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      // GitHub rejects requests without a user agent.
      'user-agent': 'revision.city',
    }
    if (token) {
      headers.authorization = `Bearer ${await token()}`
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
    }
    const response = await fetchImpl(`${GITHUB_API_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    })
    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        `GitHub returned ${response.status} for ${method} ${path}: ${await response.text()}`,
      )
    }
    return schema.parse(await response.json())
  }
}

export function repositoryPath({owner, name}: GitHubRepository): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
}

const PAGE_SIZE = 100

export interface ListAllPagesParams<Item> {
  request: GitHubRequest
  path: string
  schema: z.ZodType<Item>
  maxPages: number
}

export function listAllPages<Item>(params: ListAllPagesParams<Item>): Promise<Item[]> {
  return listPagesFrom({...params, page: 1})
}

async function listPagesFrom<Item>({
  request,
  path,
  schema,
  maxPages,
  page,
}: ListAllPagesParams<Item> & {page: number}): Promise<Item[]> {
  const separator = path.includes('?') ? '&' : '?'
  const batch = await request({
    path: `${path}${separator}per_page=${PAGE_SIZE}&page=${page}`,
    schema: z.array(schema),
  })
  return batch.length < PAGE_SIZE || page >= maxPages
    ? batch
    : [...batch, ...(await listPagesFrom({request, path, schema, maxPages, page: page + 1}))]
}

export interface PullRequestParams {
  request: GitHubRequest
  repository: GitHubRepository
  pullNumber: number
}

const pullRequestFileSchema = z.object({
  filename: z.string(),
  status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']),
  patch: z.string().optional(),
})

// GitHub lists at most 3000 files for a pull request.
const MAX_FILE_PAGES = 30

export async function listPullRequestFiles({
  request,
  repository,
  pullNumber,
}: PullRequestParams): Promise<PullRequestFile[]> {
  const files = await listAllPages({
    request,
    path: `${repositoryPath(repository)}/pulls/${pullNumber}/files`,
    schema: pullRequestFileSchema,
    maxPages: MAX_FILE_PAGES,
  })
  return files.map(({filename, status, patch}) => ({path: filename, status, patch}))
}
