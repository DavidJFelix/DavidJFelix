import {getCollection} from 'astro:content'
import rss from '@astrojs/rss'
import type {APIContext} from 'astro'
import {sortPostsByDateDesc} from '../lib/blog'

export async function GET(context: APIContext) {
  const posts = await getCollection('blog')
  const sortedPosts = sortPostsByDateDesc(posts)

  return rss({
    title: "David J. Felix's Blog",
    description: 'Thoughts on software, running, and life',
    site: context.site!,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}/`,
    })),
  })
}
