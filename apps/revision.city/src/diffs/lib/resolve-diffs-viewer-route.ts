import { normalizeGitHubPath } from './normalize-github-path';
import { DIFFS_BASE_PATH } from './site';

const GITHUB_HOST = 'github.com';

export type DiffsViewerRoute =
  | { kind: 'redirect'; target: string }
  | {
      kind: 'render';
      upstreamPath: string;
      url: string;
      domain: string | undefined;
    };

// Resolves the catch-all viewer route into either a redirect or the props the
// viewer needs to render. Extracted from the route file so it can be unit
// tested without spinning up the router. Empty paths redirect to the /diffs
// home page; GitHub paths are canonicalized via normalizeGitHubPath so direct
// navigation matches the href values getPatchViewerHref produces from form input.
// Non-GitHub hosts are passed through unchanged because their canonical form
// is unknown. Redirect targets carry the /diffs mount prefix; upstreamPath and
// url stay upstream-relative for fetching.
export function resolveDiffsViewerRoute(
  pathSegments: readonly string[],
  requestedDomainInput: string | undefined
): DiffsViewerRoute {
  if (pathSegments.length === 0) {
    return { kind: 'redirect', target: DIFFS_BASE_PATH };
  }

  const domain =
    requestedDomainInput == null || requestedDomainInput === ''
      ? undefined
      : requestedDomainInput;
  const joinedPath = `/${pathSegments.join('/')}`;
  const upstreamPath =
    domain == null ? normalizeGitHubPath(joinedPath) : joinedPath;

  if (upstreamPath !== joinedPath) {
    const query = domain == null ? '' : `?domain=${encodeURIComponent(domain)}`;
    return {
      kind: 'redirect',
      target: `${DIFFS_BASE_PATH}${upstreamPath}${query}`,
    };
  }

  const host = domain ?? GITHUB_HOST;
  return {
    domain,
    kind: 'render',
    upstreamPath,
    url: `https://${host}${upstreamPath}`,
  };
}
