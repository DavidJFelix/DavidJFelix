import {createFileRoute, redirect} from '@tanstack/react-router'

import {css} from 'styled-system/css'

import {ReviewUI} from '@/diffs/components/ReviewUI'
import {isNullish} from '@/diffs/lib/nullish'
import {resolveDiffsViewerRoute} from '@/diffs/lib/resolve-diffs-viewer-route'

// Viewer route that mirrors the upstream path below /diffs. GitHub is the
// public default, while hidden alternate domains can opt in through the
// `domain` query param. Non-canonical GitHub paths redirect to their
// canonical form before rendering.
export const Route = createFileRoute('/diffs/$')({
  validateSearch: (search: Record<string, unknown>): {domain?: string} => {
    const domain =
      typeof search.domain === 'string' && search.domain !== '' ? search.domain : undefined
    return isNullish(domain) ? {} : {domain}
  },
  beforeLoad: ({params, search}) => {
    const route = resolveDiffsViewerRoute(splatSegments(params._splat), search.domain)
    if (route.kind === 'redirect') {
      throw redirect({href: route.target})
    }
  },
  component: DiffsViewByPathPage,
})

function splatSegments(splat: string | undefined): string[] {
  return (splat ?? '').split('/').filter((segment) => segment !== '')
}

function DiffsViewByPathPage() {
  const params = Route.useParams()
  const {domain} = Route.useSearch()
  const route = resolveDiffsViewerRoute(splatSegments(params._splat), domain)

  // beforeLoad already redirected non-canonical paths; this only narrows type.
  if (route.kind !== 'render') {
    return null
  }

  return (
    <div
      className={css({
        display: 'flex',
        h: '100dvh',
        flexDirection: 'column',
        gap: '2',
      })}
    >
      <ReviewUI domain={route.domain} initialUrl={route.url} path={route.upstreamPath} />
    </div>
  )
}
