import {areWorkerStatsEqual, DEFAULT_CODE_VIEW_FILE_METRICS, queueRender} from '@pierre/diffs'
import {type CodeViewHandle, useWorkerPool} from '@pierre/diffs/react'
import type {WorkerStats} from '@pierre/diffs/worker'
import {
  IconCircleFill,
  IconEye,
  IconEyeSlash,
  IconInfoFill,
  IconRepeat,
  IconSquircleLgFill,
  IconTriangleFill,
} from '@pierre/icons'
import {type MouseEvent, memo, type RefObject, useEffect, useState} from 'react'
import {css, cx} from 'styled-system/css'
import {isNullish} from '@/diffs/lib/nullish'
import type {CommentMetadata} from '@/diffs/lib/types'
import {StatItem} from './stat-item'
import {StatusRow} from './status-row'
import type {ThemeCycleControls} from './use-theme-cycle'

// Mirrors Tailwind's `transition` utility (color/background-color/border-color/opacity).
const TRANSITION_COLORS =
  'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)'

class AutoScrollTester<LAnnotation> {
  private running: 0 | 1 | 2 = 0
  private direction = 1

  constructor(
    private viewerRef: RefObject<CodeViewHandle<LAnnotation> | null>,
    private onStateChange?: (running: boolean) => unknown,
  ) {}

  start() {
    if (this.running > 0) return
    this.running = 1
    this.onStateChange?.(true)
    this.render()
  }

  render = () => {
    const {current: viewerHandle} = this.viewerRef
    if (this.running === 0 || isNullish(viewerHandle)) {
      return
    }
    const viewer = viewerHandle.getInstance()
    if (isNullish(viewer)) {
      return
    }
    const scrollHeight = viewer.getScrollHeight()
    const scrollTop = viewer.getScrollTop()
    const clientHeight = viewer.getHeight()

    // The first scroll tick should always attempt to scroll
    if (this.running === 1) {
      this.running = 2
    }
    // If we're scrolling and we hit a boundary, lets stop, and invert the
    // direction, so next click will scroll us the other direction
    else if (this.running === 2 && (scrollTop <= 0 || scrollTop >= scrollHeight - clientHeight)) {
      this.direction *= -1
      this.stop()
      return
    }
    viewerHandle.scrollTo({
      type: 'position',
      position:
        scrollTop +
        clientHeight * 2 * this.direction +
        Math.random() * DEFAULT_CODE_VIEW_FILE_METRICS.lineHeight,
    })
    queueRender(this.render)
  }

  stop() {
    this.running = 0
    this.onStateChange?.(false)
  }

  toggleState = () => {
    if (this.running > 0) {
      this.stop()
    } else {
      this.start()
    }
  }
}

interface WorkerPoolStatusProps {
  expanded: boolean
  onToggle(): void
  themeCycle: ThemeCycleControls
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>
}

export const WorkerPoolStatus = memo(function WorkerPoolStatus({
  expanded,
  onToggle,
  themeCycle,
  viewerRef,
}: WorkerPoolStatusProps) {
  const pool = useWorkerPool()
  const [stats, setStats] = useState<WorkerStats | undefined>(undefined)
  useEffect(() => {
    if (isNullish(pool)) {
      setStats(undefined)
      return undefined
    } else {
      return pool.subscribeToStatChanges((newStats) => {
        setStats((prevStats): WorkerStats | undefined => {
          if (areWorkerStatsEqual(prevStats, newStats)) {
            return prevStats
          }
          return newStats
        })
      })
    }
  }, [pool])
  return (
    !isNullish(stats) && (
      <StatsDisplay
        expanded={expanded}
        onToggle={onToggle}
        stats={stats}
        themeCycle={themeCycle}
        viewerRef={viewerRef}
      />
    )
  )
})

interface StatsDisplayProps {
  expanded: boolean
  onToggle(): void
  stats: WorkerStats
  themeCycle: ThemeCycleControls
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>
}

// Panda classes for each status color, keyed the same way getStatusIcon
// branches so the legend row and the status indicator share one source of
// truth.
const STATUS_ICON_COLOR_CLASS = {
  failed: css({color: 'red.400'}),
  initializing: css({color: 'amber.400'}),
  initialized: css({color: 'green.400'}),
  idle: css({color: 'diffs.muted.foreground'}),
} as const

// Map worker pool status to a single icon component + color so the legend row
// and the status indicator share one source of truth.
function getStatusIcon(stats: WorkerStats) {
  if (stats.workersFailed) {
    return {Icon: IconSquircleLgFill, className: STATUS_ICON_COLOR_CLASS.failed}
  }
  if (stats.managerState === 'initializing') {
    return {
      Icon: IconTriangleFill,
      className: STATUS_ICON_COLOR_CLASS.initializing,
    }
  }
  if (stats.managerState === 'initialized') {
    return {
      Icon: IconCircleFill,
      className: STATUS_ICON_COLOR_CLASS.initialized,
    }
  }
  return {Icon: IconCircleFill, className: STATUS_ICON_COLOR_CLASS.idle}
}

function StatsDisplay({expanded, onToggle, stats, themeCycle, viewerRef}: StatsDisplayProps) {
  const [isAutoScrolling, setIsAutoScrolling] = useState(false)
  const [scrollTester] = useState(() => new AutoScrollTester(viewerRef, setIsAutoScrolling))

  // Mirror the inline (F3) hint with an actual keybinding so the label
  // doesn't lie about how to toggle the panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F3') {
        event.preventDefault()
        onToggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggle])

  const {Icon: StatusIcon, className: statusIconClass} = getStatusIcon(stats)

  return (
    <div
      className={css({
        borderColor: 'diffs.border',
        flexShrink: '0',
        overscrollBehavior: 'contain',
        borderBottomWidth: {base: '1px', md: '0'},
        fontSize: 'sm',
        lineHeight: '1.25rem',
      })}
    >
      <StatusRow icon={expanded ? IconEyeSlash : IconEye} className={css({pr: {md: '0'}})}>
        <button
          type="button"
          onClick={onToggle}
          className={css({
            color: 'diffs.muted.foreground',
            _hover: {color: 'diffs.foreground'},
            display: 'flex',
            minW: '0',
            flex: '1',
            cursor: 'pointer',
            alignItems: 'center',
            gap: '1',
            fontSize: 'sm',
            lineHeight: '1.25rem',
            _focus: {outline: 'none'},
          })}
          aria-expanded={expanded}
        >
          <span className={css({truncate: true})}>System Monitor</span>
          <span
            className={css({
              color: 'diffs.muted.foreground/50',
              display: {base: 'none', md: 'inline'},
            })}
          >
            (F3)
          </span>
        </button>
        <div
          className={css({
            ml: 'auto',
            display: 'flex',
            flexShrink: '0',
            alignItems: 'center',
            gap: '1.5',
          })}
        >
          <ThemeCycleToggle controls={themeCycle} />
          <button
            type="button"
            onClick={scrollTester.toggleState}
            className={css({
              _hover: {bg: 'diffs.muted/50', color: 'diffs.foreground'},
              color: 'diffs.muted.foreground',
              display: {base: 'none', md: 'inline-flex'},
              w: '5',
              h: '5',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              rounded: 'diffs.md',
              transition: TRANSITION_COLORS,
            })}
            title={isAutoScrolling ? 'Pause autoscroll' : 'Start autoscroll'}
            aria-label={isAutoScrolling ? 'Pause autoscroll' : 'Start autoscroll'}
            aria-pressed={isAutoScrolling}
          >
            <AutoScrollToggleIcon running={isAutoScrolling} />
          </button>
          <StatusIcon className={cx(css({w: '2', h: '2', flexShrink: '0'}), statusIconClass)} />
        </div>
      </StatusRow>
      {expanded && (
        <div className={css({ml: '10', mr: {md: '3'}})}>
          <StatItem label="Busy Workers" value={`${stats.busyWorkers}/${stats.totalWorkers}`} />
          <StatItem label="Task Queue" value={stats.queuedTasks} />
          <StatItem label="Rendered Diffs" value={stats.themeSubscribers} />
          <StatItem label="Diff Cache" value={stats.diffCacheSize} />
        </div>
      )}
      <StatusRow icon={IconInfoFill}>
        <div className={css({color: 'diffs.muted.foreground/75'})}>
          Powered by{' '}
          <a
            href="https://diffs.com"
            target="_blank"
            rel="noopener noreferrer"
            className={cx(
              'inline-link',
              css({
                color: 'diffs.muted.foreground',
                _hover: {color: 'diffs.foreground'},
                textDecorationLine: 'none',
              }),
            )}
          >
            Diffs
          </a>{' '}
          and{' '}
          <a
            href="https://trees.software"
            target="_blank"
            rel="noopener noreferrer"
            className={cx(
              'inline-link',
              css({
                color: 'diffs.muted.foreground',
                _hover: {color: 'diffs.foreground'},
                textDecorationLine: 'none',
              }),
            )}
          >
            Trees
          </a>
        </div>
      </StatusRow>
    </div>
  )
}

interface ThemeCycleToggleProps {
  controls: ThemeCycleControls
}

// Sweep-through-themes button. Plain click matches the neighboring
// autoscroll button's primary affordance — it starts (and stops) the
// rotation. Shift-click bumps the per-step duration through
// [1s, 3s, 5s, 10s]; the current value is rendered next to the icon so
// every shift-click visibly steps through the presets.
function ThemeCycleToggle({controls}: ThemeCycleToggleProps) {
  const {cycling, stepSeconds, bumpDuration, toggleCycle} = controls
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      bumpDuration()
    } else {
      toggleCycle()
    }
  }
  const title = cycling
    ? `Stop cycling themes (every ${stepSeconds}s) — shift+click to change speed`
    : `Cycle themes every ${stepSeconds}s — shift+click to change speed`
  return (
    <button
      type="button"
      onClick={handleClick}
      className={css({
        _hover: {bg: 'diffs.muted/50', color: 'diffs.foreground'},
        color: 'diffs.muted.foreground',
        display: {base: 'none', md: 'inline-flex'},
        h: '5',
        cursor: 'pointer',
        alignItems: 'center',
        gap: '1',
        rounded: 'diffs.md',
        px: '1',
        fontSize: '10px',
        lineHeight: '1',
        fontVariantNumeric: 'tabular-nums',
        transition: TRANSITION_COLORS,
      })}
      title={title}
      aria-label={title}
      aria-pressed={cycling}
    >
      <IconRepeat
        aria-hidden="true"
        className={cx(
          css({w: '3', h: '3'}),
          cycling && css({animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'}),
        )}
      />
      <span>{stepSeconds}s</span>
    </button>
  )
}

interface AutoScrollToggleIconProps {
  running: boolean
}

function AutoScrollToggleIcon({running}: AutoScrollToggleIconProps) {
  if (running) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={css({w: '3', h: '3', fill: 'currentcolor'})}
      >
        <rect x="4" y="3" width="3" height="10" rx="1" />
        <rect x="9" y="3" width="3" height="10" rx="1" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={css({w: '3', h: '3', fill: 'currentcolor'})}
    >
      <path d="M5 3.75v8.5a.75.75 0 0 0 1.14.64l6.5-4.25a.75.75 0 0 0 0-1.28l-6.5-4.25A.75.75 0 0 0 5 3.75Z" />
    </svg>
  )
}
