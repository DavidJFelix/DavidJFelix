import {getCollection} from 'astro:content'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import type {APIRoute, InferGetStaticPropsType} from 'astro'
import type {ReactNode} from 'react'
import satori from 'satori'
import sharp from 'sharp'

// Satori needs raw font data (woff/ttf, not woff2); resolving from the
// installed @fontsource package keeps binaries out of the repo and the
// rendered output independent of whatever fonts the build host has.
const require = createRequire(import.meta.url)
const interRegular = await readFile(
  require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
)
const interBold = await readFile(
  require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
)

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
        date: post.data.date as Date | undefined,
      },
    })),
  ]
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>

// Satori accepts React-element-shaped object trees, which lets this stay a
// plain .ts endpoint instead of pulling JSX into src/pages.
type ElementNode = {
  type: string
  props: Record<string, unknown> & {children?: ElementNode | ElementNode[] | string}
}

const element = (
  type: string,
  props: Record<string, unknown>,
  children?: ElementNode | ElementNode[] | string,
): ElementNode => ({type, props: {...props, children}})

const ogMarkup = ({title, description, date}: Props): ElementNode =>
  element(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: 'Inter',
      },
    },
    [
      element('div', {
        style: {
          height: '12px',
          width: '100%',
          backgroundImage: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
        },
      }),
      element(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexGrow: 1,
            padding: '64px',
          },
        },
        [
          element(
            'div',
            {style: {display: 'flex', fontSize: '32px', fontWeight: 700, color: '#a1a1aa'}},
            'djf.io',
          ),
          element('div', {style: {display: 'flex', flexDirection: 'column', gap: '24px'}}, [
            element(
              'div',
              {
                style: {
                  display: 'flex',
                  fontSize: title.length > 50 ? '56px' : '72px',
                  fontWeight: 700,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                },
              },
              title,
            ),
            element(
              'div',
              {style: {display: 'flex', fontSize: '30px', color: '#a1a1aa', lineHeight: 1.4}},
              description,
            ),
          ]),
          element(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '26px',
                color: '#71717a',
              },
            },
            [
              element('div', {style: {display: 'flex'}}, 'David J Felix'),
              element(
                'div',
                {style: {display: 'flex'}},
                date
                  ? date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })
                  : '',
              ),
            ],
          ),
        ],
      ),
    ],
  )

export const GET: APIRoute<Props> = async ({props}) => {
  const svg = await satori(ogMarkup(props) as unknown as ReactNode, {
    width: 1200,
    height: 630,
    fonts: [
      {name: 'Inter', data: interRegular, weight: 400, style: 'normal'},
      {name: 'Inter', data: interBold, weight: 700, style: 'normal'},
    ],
  })
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return new Response(new Uint8Array(png), {
    headers: {'Content-Type': 'image/png'},
  })
}
