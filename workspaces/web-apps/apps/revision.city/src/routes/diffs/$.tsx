import {ogImageSize, ogTags} from '@davidjfelix/og'
import {createFileRoute, redirect} from '@tanstack/react-router'
import {css} from 'styled-system/css'
import {ReviewUI} from '@/diffs/components/review-ui'
import {getDiffShareText} from '@/diffs/lib/diff-share-text'
import {parseGitHubDiffSource} from '@/diffs/lib/github-diff-source'
import {isNullish} from '@/diffs/lib/nullish'
import {loadPublicPullRequest} from '@/diffs/lib/public-pull-request-loader'
import {resolveDiffsViewerRoute} from '@/diffs/lib/resolve-diffs-viewer-route'
import {site} from '@/site'

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
    return {
      diffUrl: route.url,
      // Only a GitHub path has a shape the share text can name; an alternate
      // domain's path passes through as it came, and shares as the generic
      // /diffs page.
      diffSource: isNullish(route.domain) ? parseGitHubDiffSource(route.upstreamPath) : undefined,
    }
  },
  // The same path under another domain is another diff, so the loader's
  // cache key carries the domain along with the path.
  loaderDeps: ({search}) => ({domain: search.domain}),
  loader: async ({context: {diffUrl, diffSource}}) => {
    if (isNullish(diffSource)) {
      return {diffUrl, share: undefined}
    }
    // The lookup is a nicety for the title; the page must render without it,
    // so a failed round trip to the Worker on a client-side navigation reads
    // as "GitHub had no answer" rather than as a broken diff.
    const pull =
      diffSource.kind === 'pull'
        ? await loadPublicPullRequest({
            data: {...diffSource.repo, number: diffSource.number},
          }).catch(() => undefined)
        : undefined
    return {diffUrl, share: getDiffShareText({source: diffSource, pull})}
  },
  // What a pasted link unfurls as, and what the tab is called: the diff's own
  // name and its own card, over the /diffs layout's generic text. The text
  // says only what the URL and GitHub's public view of it say, so a private
  // diff never unfurls with more than its link already carries.
  head: ({loaderData}) => {
    const share = loaderData?.share
    if (isNullish(share)) {
      return {}
    }
    return {
      meta: [
        {title: `${share.title} · revision.city`},
        {name: 'description', content: share.description},
        ...ogTags({
          title: share.title,
          description: share.description,
          image: {url: new URL(share.imagePath, site.origin), alt: share.imageAlt, ...ogImageSize},
        }),
      ],
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
        h: 'dvh',
        flexDirection: 'column',
        gap: '2',
      })}
    >
      <ReviewUI domain={route.domain} path={route.upstreamPath} />
    </div>
  )
}
