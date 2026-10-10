// The mark stops a reload loop when the asset is still missing after the reload. A new deploy gives
// its assets new names, so each deploy gets its own reload.
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
