// Framework-neutral OpenGraph + Twitter card meta tags. `ogTags` returns
// plain attribute objects: spread them onto `<meta>` elements (Astro, Svelte),
// pass them in TanStack Start's `head()` meta array (its MetaDescriptor union
// includes both shapes, and head merging dedupes by name/property with the
// leaf-most route winning), or hand them to unhead's `useHead({meta})` (Nuxt).
// Only tags for provided fields are emitted, so a root/site call carries the
// defaults and a page-level call overrides just its own fields.

// The rendered card is 1200x630, the aspect every major scraper crops to;
// exported so meta tags and the renderer agree without loading `./image`.
export const ogImageSize = {width: 1200, height: 630} as const

export interface OgImage {
  url: string | URL
  alt?: string
  width?: number
  height?: number
}

export interface OgArticle {
  publishedTime: string
  author: string
  tags?: ReadonlyArray<string>
}

export interface OgTwitter {
  card?: 'summary' | 'summary_large_image'
  site?: string
  creator?: string
}

export interface OgParams {
  title?: string
  description?: string
  type?: 'website' | 'article'
  siteName?: string
  locale?: string
  url?: string | URL
  image?: OgImage
  article?: OgArticle
  twitter?: OgTwitter
}

export type OgTag = {property: string; content: string} | {name: string; content: string}

// `title`/`description` feed both og: and twitter: variants -- scrapers that
// honor twitter:* prefer it over og:*, so emitting both keeps them agreeing.
export const ogTags = (params: OgParams): Array<OgTag> => {
  const {title, description, type, siteName, locale, url, image, article, twitter} = params
  const tags: Array<OgTag | false | undefined> = [
    title !== undefined && {property: 'og:title', content: title},
    description !== undefined && {property: 'og:description', content: description},
    type !== undefined && {property: 'og:type', content: type},
    siteName !== undefined && {property: 'og:site_name', content: siteName},
    locale !== undefined && {property: 'og:locale', content: locale},
    url !== undefined && {property: 'og:url', content: String(url)},
    image !== undefined && {property: 'og:image', content: String(image.url)},
    image?.width !== undefined && {property: 'og:image:width', content: String(image.width)},
    image?.height !== undefined && {property: 'og:image:height', content: String(image.height)},
    image?.alt !== undefined && {property: 'og:image:alt', content: image.alt},
    article !== undefined && {property: 'article:published_time', content: article.publishedTime},
    article !== undefined && {property: 'article:author', content: article.author},
    ...(article?.tags ?? []).map((tag) => ({property: 'article:tag', content: tag})),
    twitter?.card !== undefined && {name: 'twitter:card', content: twitter.card},
    twitter?.site !== undefined && {name: 'twitter:site', content: twitter.site},
    twitter?.creator !== undefined && {name: 'twitter:creator', content: twitter.creator},
    title !== undefined && {name: 'twitter:title', content: title},
    description !== undefined && {name: 'twitter:description', content: description},
    image !== undefined && {name: 'twitter:image', content: String(image.url)},
    image?.alt !== undefined && {name: 'twitter:image:alt', content: image.alt},
  ]
  return tags.filter((tag): tag is OgTag => Boolean(tag))
}
