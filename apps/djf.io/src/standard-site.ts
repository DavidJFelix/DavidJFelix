/**
 * standard.site configuration for djf.io
 *
 * @see https://standard.site/docs/quick-start/
 */

export const STANDARD_SITE_DID = 'did:plc:nlbldots3jn3lk6mzca4rqzm'
export const STANDARD_SITE_PUBLICATION_RKEY = 'self'

export const publicationAtUri =
  `at://${STANDARD_SITE_DID}/site.standard.publication/${STANDARD_SITE_PUBLICATION_RKEY}` as const

export function documentAtUri(rkey: string) {
  return `at://${STANDARD_SITE_DID}/site.standard.document/${rkey}` as const
}
