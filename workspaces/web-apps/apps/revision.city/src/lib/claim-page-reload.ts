// A page can reload because an asset is missing. If the asset is still missing after the reload,
// the page must not reload again, or it reloads forever. The mark stays in session storage for the
// life of the tab. A new deploy gives its assets new names, so a later deploy gets its own reload.
const RELOAD_MARK_PREFIX = 'revision.city:reloaded-for-missing-asset:'

export interface ClaimPageReloadParams {
  assetUrl: string
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

// Returns true if the caller may reload the page for this asset. Without session storage, the page
// cannot remember a reload, so it does not reload.
export function claimPageReload({assetUrl, storage}: ClaimPageReloadParams): boolean {
  const mark = `${RELOAD_MARK_PREFIX}${assetUrl}`
  try {
    // A browser that blocks storage throws when the page reads `sessionStorage`.
    const reloadMarks = storage ?? globalThis.sessionStorage
    if (reloadMarks.getItem(mark) !== null) return false
    reloadMarks.setItem(mark, String(Date.now()))
    return true
  } catch {
    return false
  }
}
