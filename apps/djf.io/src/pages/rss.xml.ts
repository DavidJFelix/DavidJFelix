import rss from '@astrojs/rss'
import {getCollection} from 'astro:content'
import type {APIContext} from 'astro'

export async function GET(context: APIContext) {
  const posts = await getCollection('blog')
  const sortedPosts = posts.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  )

  return rss({
    title: "David J. Felix's Blog",
    description: 'Thoughts on software, running, and life',
    site: context.site!,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.slug}/`,
    })),
  })
}
