// The OpenGraph title card renderer. Takumi makes the card layout and draws
// it as a PNG in one WebAssembly module. The same code runs at build time in
// Node (djf.io's prerendered cards) and at request time on Cloudflare Workers
// (the /og/default.png of each other app). The runtimes differ only in how
// they load the wasm binary and the font bytes; see ./runtime/.
import type {ContainerNode, FontDetails, Node, SyncInitInput, TextNode} from '@takumi-rs/wasm'
import initTakumi, {Renderer} from '@takumi-rs/wasm'
import {ogImageSize} from './tags'

/** The wasm binary and the fonts that a renderer loads; each module in ./runtime/ makes one. */
export interface OgRuntime {
  /**
   * Takumi's binary (`@takumi-rs/wasm/takumi_wasm_bg.wasm`). On Workers it is a compiled module,
   * because Workers do not compile wasm from bytes at runtime. In Node it is the raw bytes.
   */
  takumi: SyncInitInput
  /** The Inter faces that the card uses. The first renderer registers them once per process. */
  fonts: ReadonlyArray<FontDetails>
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

type Style = NonNullable<ContainerNode['style']>

const box = (style: Style, children: Array<Node> = []): ContainerNode => ({
  type: 'container',
  style,
  children,
})

// Takumi draws the text of a text node as it is and never parses it, so
// markup characters in a title show as characters.
const textNode = (text: string, style: Style = {}): TextNode => ({type: 'text', text, style})

const titleBlock = (
  {title, description}: Pick<OgImageParams, 'title' | 'description'>,
  theme: OgTheme,
): ContainerNode =>
  box({display: 'flex', flexDirection: 'column', gap: '24px'}, [
    textNode(title, {
      fontSize: title.length > 50 ? '56px' : '72px',
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
    }),
    textNode(description, {fontSize: '30px', color: theme.muted, lineHeight: 1.4}),
  ])

const footer = ({author, date}: Pick<OgImageParams, 'author' | 'date'>, theme: OgTheme) =>
  box({display: 'flex', justifyContent: 'space-between', fontSize: '26px', color: theme.muted}, [
    textNode(author ?? ''),
    textNode(
      date
        ? date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          })
        : '',
    ),
  ])

/** The card as a Takumi node tree: the tree that `createOgRenderer` draws, for layout tests. */
export const ogCardNode = (params: OgImageParams): ContainerNode => {
  const theme = params.theme ?? defaultTheme
  const [accentFrom, accentTo] = theme.accent ?? [theme.foreground, theme.muted]
  return box(
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.background,
      color: theme.foreground,
      fontFamily: 'Inter',
    },
    [
      box({
        height: '12px',
        width: '100%',
        backgroundImage: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
      }),
      box(
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: 1,
          padding: '64px',
        },
        [
          textNode(params.siteName, {fontSize: '32px', fontWeight: 700, color: theme.muted}),
          titleBlock(params, theme),
          footer(params, theme),
        ],
      ),
    ],
  )
}

// Takumi keeps its wasm instance in a module-level singleton, and one Takumi
// renderer keeps the fonts between cards. The first runtime that a card
// renderer gets serves the whole process; all runtimes load the same files.
let engine: Promise<Renderer> | undefined

const prepare = (runtime: OgRuntime): Promise<Renderer> =>
  (engine ??= initTakumi({module_or_path: runtime.takumi}).then(async () => {
    const renderer = new Renderer()
    await Promise.all(runtime.fonts.map((font) => renderer.registerFont(font)))
    return renderer
  }))

export const createOgRenderer =
  (runtime: OgRuntime) =>
  async (params: OgImageParams): Promise<Uint8Array<ArrayBuffer>> => {
    const renderer = await prepare(runtime)
    return renderer.render(ogCardNode(params), ogImageSize)
  }
