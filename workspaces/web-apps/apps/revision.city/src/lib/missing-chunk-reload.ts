import {claimPageReload} from './claim-page-reload'

// A page that was open during a deploy still asks for the chunks of the old deploy, and the server
// no longer has them. Vite sends `vite:preloadError` on `window` when a lazy chunk does not load.

type ChunkFetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const CHECK_TIMEOUT_MS = 5000

// Chromium and Firefox put the chunk URL at the end of the import error message. Vite puts the path
// of a stylesheet at the end of its own preload error. Safari gives no URL.
const ASSET_URL_PATTERN = /(?:https?:\/\/|\/assets\/)\S+$/

export interface FindMissingChunkParams {
  error: unknown
  pageUrl: string
  fetch?: ChunkFetch
}

// Returns the URL of the chunk if the server answers 404 for it. A network error or any other
// status gives undefined, because a reload does not repair those.
export async function findMissingChunk({
  error,
  pageUrl,
  fetch: fetcher = fetch,
}: FindMissingChunkParams): Promise<string | undefined> {
  const match = error instanceof Error ? ASSET_URL_PATTERN.exec(error.message) : null
  if (match === null) return undefined
  const chunkUrl = new URL(match[0], pageUrl)
  if (chunkUrl.origin !== new URL(pageUrl).origin) return undefined
  try {
    const response = await fetcher(chunkUrl.href, {
      cache: 'no-store',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    await response.body?.cancel()
    return response.status === 404 ? chunkUrl.href : undefined
  } catch {
    return undefined
  }
}

export interface InstallMissingChunkReloadParams {
  target?: Pick<Window, 'addEventListener'>
  page?: Pick<Location, 'href' | 'reload'>
  fetch?: ChunkFetch
}

export function installMissingChunkReload({
  target = window,
  page = location,
  fetch: fetcher,
}: InstallMissingChunkReloadParams = {}): void {
  target.addEventListener('vite:preloadError', (event) => {
    void findMissingChunk({error: event.payload, pageUrl: page.href, fetch: fetcher}).then(
      (chunkUrl) => {
        if (chunkUrl !== undefined && claimPageReload({assetUrl: chunkUrl})) page.reload()
      },
    )
  })
}
