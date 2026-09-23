// The OpenGraph title card renderer: satori lays the card out from a
// React-element-shaped object tree, resvg rasterizes the SVG to PNG. Both run
// on WebAssembly, so one code path renders at build time in Node (djf.io's
// prerendered cards) and at request time on Cloudflare Workers (every other
// app's /og/default.png). Only how the two wasm binaries and the font bytes
// are loaded differs per runtime -- see ./runtime/.
import type {InitInput} from '@resvg/resvg-wasm'
import {initWasm, Resvg} from '@resvg/resvg-wasm'
import type {ReactNode} from 'react'
import type {Font} from 'satori/standalone'
import satori, {init as initYoga} from 'satori/standalone'
import {ogImageSize} from './tags'

export interface OgRuntime {
  // satori's Yoga layout engine (satori/yoga.wasm) and resvg's rasterizer
  // (@resvg/resvg-wasm/index_bg.wasm): compiled modules on Workers, which
  // refuse to compile wasm from bytes at runtime, raw bytes in Node.
  yoga: InitInput
  resvg: InitInput
  fonts: ReadonlyArray<Font>
}

export interface OgTheme {
  background: string
  foreground: string
  muted: string
  // The bar across the top, left to right; foreground to muted when omitted.
  accent?: readonly [string, string]
}

// djf.io's original card: dark zinc under a blue-to-violet bar.
export const defaultTheme: OgTheme = {
  background: '#09090b',
  foreground: '#f4f4f5',
  muted: '#a1a1aa',
  accent: ['#60a5fa', '#a78bfa'],
}

export interface OgImageParams {
  title: string
  description: string
  // The badge in the card's top-left corner, normally the site's domain.
  siteName: string
  // The byline in the card's footer.
  author?: string
  date?: Date
  theme?: OgTheme
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

const badge = (siteName: string, theme: OgTheme): ElementNode =>
  element(
    'div',
    {style: {display: 'flex', fontSize: '32px', fontWeight: 700, color: theme.muted}},
    siteName,
  )

const titleBlock = (
  {title, description}: Pick<OgImageParams, 'title' | 'description'>,
  theme: OgTheme,
): ElementNode =>
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
      {style: {display: 'flex', fontSize: '30px', color: theme.muted, lineHeight: 1.4}},
      description,
    ),
  ])

const footer = ({author, date}: Pick<OgImageParams, 'author' | 'date'>, theme: OgTheme) =>
  element(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '26px',
        color: theme.muted,
      },
    },
    [
      element('div', {style: {display: 'flex'}}, author ?? ''),
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

const ogMarkup = (params: OgImageParams, theme: OgTheme): ElementNode => {
  const [accentFrom, accentTo] = theme.accent ?? [theme.foreground, theme.muted]
  return element(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.background,
        color: theme.foreground,
        fontFamily: 'Inter',
      },
    },
    [
      element('div', {
        style: {
          height: '12px',
          width: '100%',
          backgroundImage: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
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
        [badge(params.siteName, theme), titleBlock(params, theme), footer(params, theme)],
      ),
    ],
  )
}

// Both engines initialize into module-level singletons (resvg refuses a
// second initWasm), so the first runtime handed to a renderer serves the
// whole process; every runtime loads the same binaries anyway.
let ready: Promise<void> | undefined

const prepare = (runtime: OgRuntime): Promise<void> =>
  (ready ??= Promise.all([initYoga(runtime.yoga), initWasm(runtime.resvg)]).then(() => undefined))

export const createOgRenderer =
  (runtime: OgRuntime) =>
  async (params: OgImageParams): Promise<Uint8Array<ArrayBuffer>> => {
    await prepare(runtime)
    const markup = ogMarkup(params, params.theme ?? defaultTheme) as unknown as ReactNode
    const svg = await satori(markup, {...ogImageSize, fonts: [...runtime.fonts]})
    // Explicit frees return the wasm memory to resvg's allocator between
    // requests instead of waiting on the finalization registry. The copy
    // pins the bytes to a plain ArrayBuffer, which is what a Response body
    // takes; asPng's declared type leaves the buffer kind open.
    const resvg = new Resvg(svg)
    const image = resvg.render()
    const png = new Uint8Array(image.asPng())
    image.free()
    resvg.free()
    return png
  }
