import type {ChangeTypes} from '@pierre/diffs'

import {
  type CodebergDiffFileServerOptions,
  loadCodebergDiffFiles,
} from './codeberg-diff-file-server'
import {isNullish} from './nullish'

const CHANGE_TYPES: readonly ChangeTypes[] = [
  'change',
  'deleted',
  'new',
  'rename-changed',
  'rename-pure',
]

// Expands a Codeberg diff entry into full old and new file contents so the
// viewer can show unchanged context lines. Codeberg has no sign-in yet, so this
// reads public repositories only.
export async function handleCodebergDiffFileRequest(
  request: Request,
  options: CodebergDiffFileServerOptions = {},
): Promise<Response> {
  const params = new URL(request.url).searchParams
  const path = params.get('path')
  const name = params.get('name')
  const type = parseChangeType(params.get('type'))
  const prevName = params.get('prevName') ?? undefined

  if (isNullish(path) || isNullish(name) || isNullish(type)) {
    return createJSONResponse(
      {error: 'path, name, and supported type parameters are required.'},
      400,
    )
  }

  try {
    return createJSONResponse(
      await loadCodebergDiffFiles({name, path, prevName, type}, options),
      200,
    )
  } catch (error) {
    return createJSONResponse(
      {error: error instanceof Error ? error.message : 'Unknown error'},
      502,
    )
  }
}

function parseChangeType(value: string | null): ChangeTypes | undefined {
  return CHANGE_TYPES.find((candidate) => candidate === value)
}

function createJSONResponse(body: unknown, status: number): Response {
  return Response.json(body, {status, headers: {'Cache-Control': 'no-store'}})
}
