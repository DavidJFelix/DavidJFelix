import {Link} from '@tanstack/react-router'
import {type ReactNode, useMemo} from 'react'

import {css, cx} from 'styled-system/css'

import type {InboxItem, InboxReason} from '@/inbox/lib/inbox-item'
import {formatRelativeTime} from '@/inbox/lib/relative-time'

const REASON_LABELS: Record<InboxReason, string> = {
  'review-requested': 'Review requested',
  assigned: 'Assigned to you',
  owned: 'Your repository',
  member: 'Your organization',
  watched: 'Watching',
}

const SKELETON_TITLE_STYLES = ['60%', '48%', '36%', '54%', '42%', '30%'].map((width) => ({width}))

// The full date and time in the language of the visitor, for the tooltip of the relative time.
const fullTimeFormat = new Intl.DateTimeFormat(undefined, {dateStyle: 'long', timeStyle: 'short'})

export const listSurfaceClass = css({
  bg: 'diffs.background',
  rounded: 'diffs.lg',
  borderWidth: '1px',
})

const listClass = css({'& > li + li': {borderTopWidth: '1px', borderColor: 'diffs.border/70'}})

// Line 1 holds the title, and line 2 holds the details. From 640px the time has a column at the
// end of both lines. Below 640px the time is the last of the details.
const rowClass = css({
  display: 'grid',
  gridTemplateColumns: {base: '[minmax(0, 1fr)]', sm: '[minmax(0, 1fr) auto]'},
  gridTemplateAreas: {base: '"title" "details"', sm: '"title time" "details time"'},
  columnGap: '4',
  rowGap: '1',
  px: '4',
  py: '3',
})

const rowLinkClass = css({
  color: 'diffs.foreground',
  transition: '[background-color 150ms ease]',
  _hover: {bg: 'diffs.accent', _dark: {bg: 'diffs.accent/50'}},
  // Same keyboard focus outline as CHROME_ICON_BUTTON_CLASS.
  _focusVisible: {
    outline: '[2px solid]',
    outlineColor: 'currentColor !important',
    outlineOffset: '[-2px]',
  },
  'li:first-child > &': {roundedTop: '[calc(var(--radius) - 1px)]'},
  'li:last-child > &': {roundedBottom: '[calc(var(--radius) - 1px)]'},
})

const titleLineClass = css({
  gridArea: 'title',
  display: 'flex',
  alignItems: 'baseline',
  gap: '2',
  minW: '0',
})

const titleClass = css({
  minW: '0',
  fontSize: 'md',
  lineHeight: '[1.5rem]',
  fontWeight: 'medium',
  lineClamp: '2',
  overflowWrap: 'anywhere',
})

// A line of details that wraps between details. Each detail starts with a separator, and the
// negative margin moves the separator of the first detail on a line into the clipped edge.
const detailsFlow = css.raw({
  flexWrap: 'wrap',
  alignItems: 'baseline',
  columnGap: '4',
  minW: '0',
  overflow: 'hidden',
})

// Below 640px the time joins the details in one flow. From 640px this box has no layout of its
// own, so the details and the time each take their own grid area.
const detailsClass = css(detailsFlow, {
  gridArea: 'details',
  display: {base: 'flex', sm: 'contents'},
  color: 'diffs.muted.foreground',
  fontSize: 'sm',
  lineHeight: '[1.25rem]',
})

const metaClass = css(detailsFlow, {gridArea: 'details', display: {base: 'contents', sm: 'flex'}})

const detailClass = css({ms: '-4', overflowWrap: 'anywhere'})

const separatorClass = css({display: 'inline-block', w: '4', textAlign: 'center'})

const referenceClass = css({fontFamily: 'diffs.mono', fontSize: 'xs', letterSpacing: 'tight'})

const timeDetailClass = css({
  gridArea: 'time',
  justifySelf: 'end',
  whiteSpace: 'nowrap',
  sm: {ms: '0', lineHeight: '[1.5rem]', '& > [aria-hidden]': {display: 'none'}},
})

const timeClass = css({fontVariantNumeric: 'tabular-nums'})

const draftBadgeClass = css({
  flexShrink: '0',
  color: 'diffs.muted.foreground',
  rounded: 'full',
  borderWidth: '1px',
  borderColor: '[color-mix(in oklab, currentcolor 20%, transparent)]',
  px: '1.5',
  py: '0.5',
  fontSize: '[10px]',
  lineHeight: 'none',
  letterSpacing: 'wide',
  textTransform: 'uppercase',
})

// The line boxes of the skeleton have the line heights of the title and the details.
const skeletonTitleLineClass = css({
  gridArea: 'title',
  display: 'flex',
  alignItems: 'center',
  h: '[1.5rem]',
})

const skeletonDetailsLineClass = css({
  gridArea: 'details',
  display: 'flex',
  alignItems: 'center',
  h: '[1.25rem]',
})

const skeletonBar = css.raw({
  rounded: 'full',
  bg: 'diffs.muted.foreground/15',
  _motionSafe: {animation: 'pulse'},
})

const skeletonTitleBarClass = css(skeletonBar, {h: '3'})

const skeletonDetailsBarClass = css(skeletonBar, {h: '2.5', w: '[40%]'})

interface InboxListProps {
  items: readonly InboxItem[]
  // The current time in milliseconds since the epoch.
  now: number
}

export function InboxList({items, now}: InboxListProps) {
  return (
    <ul className={cx(listSurfaceClass, listClass)}>
      {items.map((item) => (
        <li key={`${item.owner}/${item.repo}#${item.number}`}>
          <InboxRow item={item} now={now} />
        </li>
      ))}
    </ul>
  )
}

interface InboxRowProps {
  item: InboxItem
  now: number
}

function InboxRow({item, now}: InboxRowProps) {
  const details = [
    ...(item.author === undefined ? [] : [`by ${item.author}`]),
    ...item.reasons.map((reason) => REASON_LABELS[reason]),
  ]
  const params = useMemo(
    () => ({_splat: `${item.owner}/${item.repo}/pull/${item.number}`}),
    [item.owner, item.repo, item.number],
  )
  return (
    <Link to="/diffs/$" params={params} className={cx(rowClass, rowLinkClass)}>
      <span className={titleLineClass}>
        <span className={titleClass}>{item.title}</span>
        {item.draft ? <span className={draftBadgeClass}>Draft</span> : null}
      </span>
      <span className={detailsClass}>
        <span className={metaClass}>
          <Detail className={referenceClass}>
            {item.owner}/{item.repo}#{item.number}
          </Detail>
          {details.map((detail) => (
            <Detail key={detail}>{detail}</Detail>
          ))}
        </span>
        <UpdateTime time={item.updatedAt} now={now} />
      </span>
    </Link>
  )
}

interface DetailProps {
  className?: string
  children: ReactNode
}

function Detail({className, children}: DetailProps) {
  return (
    <span className={cx(detailClass, className)}>
      <span aria-hidden="true" className={separatorClass}>
        ·
      </span>
      {children}
    </span>
  )
}

interface UpdateTimeProps {
  time: string | undefined
  now: number
}

function UpdateTime({time, now}: UpdateTimeProps) {
  const text = formatRelativeTime({time, now})
  if (time === undefined || text === undefined) {
    return null
  }
  return (
    <Detail className={timeDetailClass}>
      <time className={timeClass} dateTime={time} title={fullTimeFormat.format(Date.parse(time))}>
        {text}
      </time>
    </Detail>
  )
}

// Rows of the same height as an inbox row with a one-line title, so that the page does not move
// when the list arrives.
export function InboxSkeleton() {
  return (
    <ul aria-hidden="true" className={cx(listSurfaceClass, listClass)}>
      {SKELETON_TITLE_STYLES.map((style) => (
        <li key={style.width} className={rowClass}>
          <span className={skeletonTitleLineClass}>
            <span className={skeletonTitleBarClass} style={style} />
          </span>
          <span className={skeletonDetailsLineClass}>
            <span className={skeletonDetailsBarClass} />
          </span>
        </li>
      ))}
    </ul>
  )
}
