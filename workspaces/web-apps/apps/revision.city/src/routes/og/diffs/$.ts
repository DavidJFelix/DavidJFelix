import {ogCards} from '@davidjfelix/og/card'
import {viteRuntime} from '@davidjfelix/og/runtime/vite'
import {createFileRoute} from '@tanstack/react-router'

import {getDiffShareText, parseDiffCardPath} from '@/diffs/lib/diff-share-text'
import {readGitHubAppCredentials} from '@/diffs/lib/github-auth'
import {fetchPublicPullRequest} from '@/diffs/lib/github-public-pull-request'
import {isNullish} from '@/diffs/lib/nullish'
import {diffCardTheme, site} from '@/site'

// An hour, matching the pull request lookup behind it: a title can change,
// and the card should follow within the day rather than after it.
const CARD_MAX_AGE_SECONDS = 60 * 60
// A card drawn without GitHub's answer (a private or missing pull request, or
// no answer in time) lives only as long as the lookup remembers a miss, so a
// passing failure is not baked into the edge for the full hour.
const FALLBACK_CARD_MAX_AGE_SECONDS = 5 * 60

// The share card behind every /diffs/<path> link, at /og/diffs/<path>.png:
// rendered on the Worker from the same text the page's og: tags carry, and
// kept in the edge cache. Scrapers fetch it without the visitor's cookie, so
// it asks GitHub only for what GitHub shows to anyone.
const card = ogCards({
  runtime: viteRuntime,
  maxAge: CARD_MAX_AGE_SECONDS,
  card: async (request) => {
    const source = parseDiffCardPath(new URL(request.url).pathname)
    if (isNullish(source)) {
      return undefined
    }
    const pull =
      source.kind === 'pull'
        ? await fetchPublicPullRequest({
            repo: source.repo,
            number: source.number,
            credentials: readGitHubAppCredentials(),
          })
        : undefined
    return {
      ...getDiffShareText({source, pull}).card,
      siteName: site.siteName,
      theme: diffCardTheme,
      ...(source.kind === 'pull' && isNullish(pull) ? {maxAge: FALLBACK_CARD_MAX_AGE_SECONDS} : {}),
    }
  },
})

export const Route = createFileRoute('/og/diffs/$')({
  server: {handlers: {GET: ({request}) => card(request)}},
})
