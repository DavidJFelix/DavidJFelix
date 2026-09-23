import {getCollection} from 'astro:content'
import {createOgRenderer} from '@davidjfelix/og/image'
import {nodeRuntime} from '@davidjfelix/og/runtime/node'
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

// Prerendered, so the cards are rendered once at build in Node: the runtime
// reads satori's and resvg's wasm plus the Inter files from this app's tree.
const render = createOgRenderer(await nodeRuntime())

export const GET: APIRoute<Props> = async ({props}) => {
  const png = await render({...props, siteName: 'djf.io', author: 'David J Felix'})
  return new Response(png, {
    headers: {'Content-Type': 'image/png'},
  })
}
