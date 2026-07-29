import {IconArrowRightShort} from '@pierre/icons'
import {createFileRoute, Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

import {SiteMark} from '@/components/site-mark'
import diffsCss from '@/diffs/diffs.css?url'

// The home page adopts the diffs theme (diffs.css; the root shell already
// resolves the color scheme pre-paint) rather than the plain Panda palette, so
// moving between / and /diffs never changes fonts, surfaces, or color scheme.
// Content-wise it is a front door for the one part of the city that is open:
// status is told in diff notation -- an added line for diffs, with reviews and
// repos as context lines that have not landed yet.
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{name: 'description', content: 'Version control, centered on review.'}],
    links: [{rel: 'stylesheet', href: diffsCss}],
  }),
  component: Home,
})

const pageClass = css({
  display: 'flex',
  minH: 'svh',
  flexDirection: 'column',
  alignItems: 'center',
})

const mainClass = css({
  display: 'flex',
  flex: '1',
  w: '2xl',
  maxW: 'screen',
  flexDirection: 'column',
  justifyContent: 'center',
  '& > * + *': {mt: '4'},
  px: '6',
  py: '8',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
  '@media (min-width: 340px)': {fontSize: '[base]', lineHeight: '[1.5rem]'},
})

const headingClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1.5',
  fontSize: '2xl',
  lineHeight: '[2rem]',
  fontWeight: 'semibold',
  letterSpacing: 'tight',
})

const taglineClass = css({fontSize: 'lg', fontWeight: 'medium', letterSpacing: 'tight'})

const pitchClass = css({color: 'diffs.muted.foreground', textWrap: '[pretty]'})

const footerClass = css({w: '2xl', maxW: 'screen', px: '6', pb: '8'})

const footerRuleClass = css({mb: '6', maxW: '[80px]', opacity: '0.5'})

const footerTextClass = css({
  color: 'diffs.muted.foreground',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
})

function Home() {
  return (
    <div className={pageClass}>
      <main className={mainClass}>
        <h1 className={headingClass}>
          <SiteMark />
          revision.city
        </h1>
        <p className={taglineClass}>Version control, centered on review.</p>
        <p className={pitchClass}>
          Reviews and diffs as first-class objects, not afterthoughts bolted onto a repository. The
          city is still under construction; here is where it stands:
        </p>
        <Roadmap />
        <OpenDiffsCard />
      </main>
      <footer className={footerClass}>
        <hr className={footerRuleClass} />
        <p className={footerTextClass}>© 2026 revision.city</p>
      </footer>
    </div>
  )
}

const roadmapClass = css({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  columnGap: '3',
  rowGap: '[2px]',
  fontFamily: 'diffs.mono',
  letterSpacing: 'tight',
  lineHeight: '[22px]',
  listStyleType: 'none',
  p: '0',
})

const roadmapRowClass = css({display: 'contents'})

// The diff-line treatment from the /diffs landing: a 4px gutter border with a
// tinted badge for added lines; context lines keep the same metrics (border
// slot, padding, two-space marker) so every name starts at the same column.
const roadmapName = css.raw({
  display: 'inline-flex',
  borderLeftWidth: '4px',
  borderColor: 'transparent',
  roundedLeft: 'sm',
  py: '[0.0625rem]',
  px: '1.5',
  whiteSpace: 'pre',
})

const addedNameClass = css(roadmapName, {
  borderColor: '[#07c480]',
  roundedRight: 'sm',
  bg: '[rgb(7 196 128 / 0.15)]',
  color: '[#18a46c]',
  transition: '[background-color 150ms ease]',
  _hover: {bg: '[rgb(7 196 128 / 0.25)]'},
  _dark: {
    bg: '[rgb(7 196 128 / 0.1)]',
    color: '[#07c480]',
    _hover: {bg: '[rgb(7 196 128 / 0.2)]'},
  },
})

const contextNameClass = css(roadmapName, {color: 'diffs.muted.foreground'})

const roadmapNoteClass = css({
  color: 'diffs.muted.foreground',
  alignSelf: 'center',
  textWrap: '[pretty]',
})

function Roadmap() {
  return (
    <ul className={roadmapClass}>
      <li className={roadmapRowClass}>
        <Link to="/diffs" className={addedNameClass}>
          + diffs
        </Link>
        <span className={roadmapNoteClass}>a fast, virtualized viewer for any GitHub diff</span>
      </li>
      <li className={roadmapRowClass}>
        <span className={contextNameClass}>{'  reviews'}</span>
        <span className={roadmapNoteClass}>reviews as objects of their own, in progress</span>
      </li>
      <li className={roadmapRowClass}>
        <span className={contextNameClass}>{'  repos'}</span>
        <span className={roadmapNoteClass}>hosted repositories, not yet</span>
      </li>
    </ul>
  )
}

const openDiffsCardClass = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  bg: 'diffs.background',
  rounded: 'diffs.lg',
  borderWidth: '1px',
  px: '4',
  py: '3',
  transition: '[border-color 150ms ease]',
  _hover: {borderColor: 'diffs.ring'},
})

const openDiffsTitleClass = css({display: 'block', fontWeight: 'semibold'})

const openDiffsHintClass = css({
  display: 'block',
  mt: '1',
  color: 'diffs.muted.foreground',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
  textWrap: '[pretty]',
})

function OpenDiffsCard() {
  return (
    <Link to="/diffs" className={openDiffsCardClass}>
      <span>
        <span className={openDiffsTitleClass}>Open Diffs</span>
        <span className={openDiffsHintClass}>
          Put <code>revision.city/diffs/</code> in front of any <code>github.com</code> URL, or
          paste one on the next page.
        </span>
      </span>
      <IconArrowRightShort className={css({flexShrink: '0', opacity: '0.5'})} />
    </Link>
  )
}
