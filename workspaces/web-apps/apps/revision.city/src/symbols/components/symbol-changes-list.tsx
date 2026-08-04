import {IconBraces} from '@pierre/icons'
import {memo} from 'react'

import {css, cx} from 'styled-system/css'
import {isNullish} from '@/diffs/lib/nullish'
import {CHANGE_STYLES, KIND_LABELS} from '@/symbols/lib/change-presentation'
import type {EntityChange} from '@/symbols/lib/entity'
import type {EntityDiffEntry} from './use-entity-diffs'

export interface SymbolSelection {
  itemId: string
  lineNumber: number
  side: 'additions' | 'deletions'
}

interface SymbolChangesListProps {
  entries: readonly EntityDiffEntry[]
  onSelectItem?(itemId: string): void
  onSelectSymbol?(selection: SymbolSelection): void
  signedIn: boolean
}

export const SymbolChangesList = memo(function SymbolChangesList({
  entries,
  onSelectItem,
  onSelectSymbol,
  signedIn,
}: SymbolChangesListProps) {
  if (!signedIn) {
    return (
      <EmptyState title="Sign in to track symbols">
        Symbol tracking reads both revisions of each file from GitHub, so it needs a signed-in
        session.
      </EmptyState>
    )
  }

  const sections = entries.filter((entry) => (entry.diff?.changes.length ?? 0) > 0)
  const pendingCount = entries.filter(
    (entry) => entry.status === 'pending' || entry.status === 'loading',
  ).length
  const failedCount = entries.filter((entry) => entry.status === 'error').length

  if (sections.length === 0 && pendingCount === 0) {
    return (
      <EmptyState title="No symbol changes">
        {failedCount > 0
          ? 'The files in this diff could not be read for symbols.'
          : 'Nothing in this diff changed a function, class, or key that can be named.'}
      </EmptyState>
    )
  }

  return (
    <SymbolSections
      onSelectItem={onSelectItem}
      onSelectSymbol={onSelectSymbol}
      pendingCount={pendingCount}
      sections={sections}
    />
  )
})

interface SymbolSectionsProps {
  onSelectItem?(itemId: string): void
  onSelectSymbol?(selection: SymbolSelection): void
  pendingCount: number
  sections: readonly EntityDiffEntry[]
}

function SymbolSections({
  onSelectItem,
  onSelectSymbol,
  pendingCount,
  sections,
}: SymbolSectionsProps) {
  return (
    <div
      className={cx(
        'cv-mini-scrollbar',
        css({
          h: 'full',
          minH: '0',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          pl: '3',
          pb: '3',
          pr: '[max(0px, calc(12px - var(--cv-mini-gutter-vertical)))]',
        }),
      )}
    >
      {sections.map((entry) => (
        <FileSection
          key={entry.itemId}
          entry={entry}
          onSelectItem={onSelectItem}
          onSelectSymbol={onSelectSymbol}
        />
      ))}
      {pendingCount > 0 && (
        <p
          aria-live="polite"
          className={css({
            color: 'diffs.muted.foreground',
            px: '3',
            py: '2',
            fontSize: 'xs',
            lineHeight: '[1rem]',
          })}
        >
          Reading {pendingCount} more {pendingCount === 1 ? 'file' : 'files'}...
        </p>
      )}
    </div>
  )
}

interface FileSectionProps {
  entry: EntityDiffEntry
  onSelectItem?(itemId: string): void
  onSelectSymbol?(selection: SymbolSelection): void
}

function FileSection({entry, onSelectItem, onSelectSymbol}: FileSectionProps) {
  const changes = entry.diff?.changes ?? []
  return (
    <section>
      <button
        type="button"
        disabled={isNullish(onSelectItem)}
        className={css({
          color: 'diffs.muted.foreground',
          _hover: {color: 'diffs.foreground'},
          _disabled: {cursor: 'default', _hover: {color: 'diffs.muted.foreground'}},
          display: 'block',
          w: 'full',
          cursor: 'pointer',
          p: '3',
          pb: '2',
          textAlign: 'left',
          fontSize: 'sm',
          lineHeight: '[1.25rem]',
          fontWeight: 'medium',
          wordBreak: 'break-all',
          outline: 'none',
          _focusVisible: {boxShadow: '[0 0 0 2px var(--ring)]'},
        })}
        onClick={() => onSelectItem?.(entry.itemId)}
      >
        {entry.name}
      </button>
      <div
        className={css({
          rounded: 'diffs.lg',
          borderWidth: '1px',
          borderColor: 'var(--diffs-card-border, rgb(0 0 0 / 0.1))',
          overflow: 'hidden',
          _dark: {borderColor: 'var(--diffs-card-border, rgb(255 255 255 / 0.15))'},
        })}
      >
        {changes.map((change) => (
          <SymbolRow
            key={`${change.type}:${change.kind}:${change.qualifiedName}`}
            change={change}
            itemId={entry.itemId}
            onSelectSymbol={onSelectSymbol}
          />
        ))}
      </div>
    </section>
  )
}

interface SymbolRowProps {
  change: EntityChange
  itemId: string
  onSelectSymbol?(selection: SymbolSelection): void
}

function SymbolRow({change, itemId, onSelectSymbol}: SymbolRowProps) {
  const style = CHANGE_STYLES[change.type]
  // A deleted entity only exists on the left; everything else is anchored to
  // where it now lives.
  const side = change.type === 'deleted' ? 'deletions' : 'additions'
  const lineNumber =
    change.type === 'deleted' ? change.oldRange?.startLine : change.newRange?.startLine

  return (
    <button
      type="button"
      disabled={isNullish(onSelectSymbol) || lineNumber === undefined}
      title={`${style.label} ${KIND_LABELS[change.kind]} ${change.qualifiedName}`}
      className={css({
        display: 'flex',
        w: 'full',
        cursor: 'pointer',
        alignItems: 'baseline',
        gap: '2',
        borderBottomWidth: '1px',
        borderColor: 'var(--diffs-card-border, rgb(0 0 0 / 0.1))',
        bg: 'var(--diffs-card-bg, var(--card))',
        px: '3',
        py: '2',
        textAlign: 'left',
        fontSize: 'sm',
        lineHeight: '[1.25rem]',
        outline: 'none',
        _last: {borderBottomWidth: '0'},
        _hover: {bg: 'var(--diffs-card-hover-bg, rgb(0 0 0 / 0.04))'},
        _disabled: {cursor: 'default', _hover: {bg: 'var(--diffs-card-bg, var(--card))'}},
        _focusVisible: {boxShadow: '[inset 0 0 0 2px var(--ring)]'},
        _dark: {borderColor: 'var(--diffs-card-border, rgb(255 255 255 / 0.15))'},
      })}
      onClick={() => {
        if (lineNumber !== undefined) {
          onSelectSymbol?.({itemId, lineNumber, side})
        }
      }}
    >
      <span
        aria-hidden="true"
        className={css({
          w: '3',
          flexShrink: '0',
          textAlign: 'center',
          fontFamily: 'diffs.mono',
          fontSize: 'xs',
          lineHeight: '[1rem]',
          fontWeight: 'semibold',
        })}
        style={{color: style.color}}
      >
        {style.sigil}
      </span>
      <span className={css({display: 'flex', minW: '0', flexDirection: 'column', gap: '0.5'})}>
        <span
          className={css({
            fontFamily: 'diffs.mono',
            fontSize: 'xs',
            lineHeight: '[1rem]',
            wordBreak: 'break-all',
          })}
        >
          <span className={css({srOnly: true})}>{style.label} </span>
          {change.qualifiedName}
        </span>
        <span
          className={css({
            color: 'diffs.muted.foreground',
            fontSize: 'xs',
            lineHeight: '[1rem]',
          })}
        >
          {KIND_LABELS[change.kind]}
          {!isNullish(change.previousQualifiedName) && ` · was ${change.previousQualifiedName}`}
        </span>
      </span>
    </button>
  )
}

interface EmptyStateProps {
  children: string
  title: string
}

function EmptyState({children, title}: EmptyStateProps) {
  return (
    <div
      className={css({
        color: 'diffs.muted.foreground',
        display: 'flex',
        h: 'full',
        minH: '0',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2',
        px: '7',
        textAlign: 'center',
        fontSize: 'sm',
        lineHeight: '[1.25rem]',
      })}
    >
      <IconBraces size={24} className={css({mb: '2'})} />
      <div className={css({display: 'flex', flexDirection: 'column'})}>
        <strong className={css({fontWeight: 'medium'})}>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}
