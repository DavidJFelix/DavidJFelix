// JSON-LD builders for the pages that emit structured data: Person and
// WebSite on the home and about pages, BreadcrumbList on blog posts.
// Absolute URLs need Astro.site; when it is unset (unit-test containers,
// bare local builds) the url fields stay undefined and JSON.stringify
// drops them.

// The profile links search engines should treat as the same identity as
// djf.io. Twitter is still Twitter here; Bluesky is the @djf.io handle the
// site already proves via /.well-known/atproto-did.
export const PROFILE_URLS = [
  'https://github.com/davidjfelix',
  'https://twitter.com/davidjfelix',
  'https://bsky.app/profile/djf.io',
]

export function person(site?: URL): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'David J Felix',
    url: site?.href,
    sameAs: PROFILE_URLS,
  }
}

export function webSite(site?: URL): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'djf.io',
    url: site?.href,
  }
}

export function breadcrumbs(
  site: URL | undefined,
  trail: ReadonlyArray<{name: string; path: string}>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(({name, path}, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: site ? new URL(path, site).href : undefined,
    })),
  }
}
