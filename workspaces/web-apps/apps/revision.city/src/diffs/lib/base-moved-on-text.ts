interface BaseMovedOnTextParams {
  // The compare range from the URL, such as `main...feature` or `feature`.
  range: string
  behindBy: number
}

// Says that a compare's base branch moved on after the merge base. A one-ref
// range compares against the default branch, whose name the URL does not hold.
export function baseMovedOnText({range, behindBy}: BaseMovedOnTextParams): string {
  const refs = range.split('...')
  const base = refs.length === 2 && refs[0] !== '' ? refs[0] : 'The base branch'
  const commits = behindBy === 1 ? '1 commit' : `${behindBy} commits`
  return `${base} moved on ${commits} since the merge base`
}
