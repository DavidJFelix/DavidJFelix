import {getCollection} from 'astro:content'
import {renderOgImage} from '@davidjfelix/og/image'
import type {APIRoute, InferGetStaticPropsType} from 'astro'

export const getStaticPaths = async () => {
  const posts = await getCollection('blog')
  return [
    {
      params: {slug: 'default'},
      props: {
        title: 'David J Felix',
        description: 'Thoughts on software, running, and life',
        date: undefined as Date | undefined,
      },
    },
    ...posts.map((post) => ({
      params: {slug: `blog/${post.id}`},
      props: {
        title: post.data.title,
        description: post.data.description,
        date: post.data.date,
      },
    })),
  ]
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>

export const GET: APIRoute<Props> = async ({props}) => {
  const png = await renderOgImage({...props, siteName: 'djf.io', author: 'David J Felix'})
  return new Response(new Uint8Array(png), {
    headers: {'Content-Type': 'image/png'},
  })
}
