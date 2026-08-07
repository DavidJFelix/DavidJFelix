// The OpenGraph title card renderer extracted from djf.io's prerendered
// `/og/*.png` endpoint: satori lays the card out from a React-element-shaped
// object tree, sharp rasterizes the SVG to PNG. Node-only (font files, sharp
// native bindings) and build-time only -- keep it out of anything that ships
// to a browser or a worker, which is why it lives on its own `./image`
// subpath away from the tags module.
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import type {ReactNode} from 'react'
import satori from 'satori'
import sharp from 'sharp'
import {ogImageSize} from './tags.ts'

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

export interface OgImageParams {
  title: string
  description: string
  // The badge in the card's top-left corner, normally the site's domain.
  siteName: string
  // The byline in the card's footer.
  author: string
  date?: Date
}

// Satori accepts React-element-shaped object trees, which lets this stay a
// plain .ts module instead of pulling JSX into the package.
interface ElementNode {
  type: string
  props: Record<string, unknown> & {children?: ElementNode | Array<ElementNode> | string}
}

const element = (
  type: string,
  props: Record<string, unknown>,
  children?: ElementNode | Array<ElementNode> | string,
): ElementNode => ({type, props: {...props, children}})

const badge = (siteName: string): ElementNode =>
  element(
    'div',
    {style: {display: 'flex', fontSize: '32px', fontWeight: 700, color: '#a1a1aa'}},
    siteName,
  )

const titleBlock = ({title, description}: Pick<OgImageParams, 'title' | 'description'>) =>
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
  ])

const footer = ({author, date}: Pick<OgImageParams, 'author' | 'date'>): ElementNode =>
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
      element('div', {style: {display: 'flex'}}, author),
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
  )

const ogMarkup = ({title, description, siteName, author, date}: OgImageParams): ElementNode =>
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
        [badge(siteName), titleBlock({title, description}), footer({author, date})],
      ),
    ],
  )

export const renderOgImage = async (params: OgImageParams): Promise<Buffer> => {
  const svg = await satori(ogMarkup(params) as unknown as ReactNode, {
    ...ogImageSize,
    fonts: [
      {name: 'Inter', data: interRegular, weight: 400, style: 'normal'},
      {name: 'Inter', data: interBold, weight: 700, style: 'normal'},
    ],
  })
  return sharp(Buffer.from(svg)).png().toBuffer()
}
