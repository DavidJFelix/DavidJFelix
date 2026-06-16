// Pure helpers for the blog list and tag pages, extracted from the .astro pages
// (rss.xml, blog/index, blog/tags/*) and the BlogPost layout, where the same
// sort / tag-aggregation / date-format logic was duplicated inline. Structurally
// typed rather than tied to astro:content's CollectionEntry, so they're trivial
// to unit test with plain fixtures and reusable across every page.

type DatedPost = {data: {date: Date}}
type TaggedPost = {data: {tags?: Array<string>}}

// Newest first. Returns a new array; does not mutate the input.
export function sortPostsByDateDesc<T extends DatedPost>(posts: ReadonlyArray<T>): Array<T> {
  return [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

// Every distinct tag across the posts, in first-seen order.
export function collectTags(posts: ReadonlyArray<TaggedPost>): Array<string> {
  const tags = new Set<string>()
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) tags.add(tag)
  }
  return [...tags]
}

// [tag, count] pairs, most-used first.
export function tagCountsDesc(posts: ReadonlyArray<TaggedPost>): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

// Posts carrying `tag`, newest first.
export function postsForTag<T extends DatedPost & TaggedPost>(
  posts: ReadonlyArray<T>,
  tag: string,
): Array<T> {
  return sortPostsByDateDesc(posts.filter((post) => post.data.tags?.includes(tag)))
}

// Long-form en-US date, e.g. "December 7, 2025" -- the format shown across the
// blog UI.
export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
}
