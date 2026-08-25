import {css} from 'styled-system/css'
import {isNullish} from '@/diffs/lib/nullish'
import {CHANGE_STYLES} from '@/symbols/lib/change-presentation'
import type {SequenceEdit} from '@/symbols/lib/entity'
import type {SymbolSelection} from './symbol-changes-list'

// Element edits beyond this stay behind a count: a reviewer scanning a huge
// churned array needs "and 40 more", not forty rows.
const MAX_VISIBLE_EDITS = 8

interface SequenceEditRowsProps {
  edits: readonly SequenceEdit[]
  itemId: string
  onSelectSymbol?: (selection: SymbolSelection) => void
}

export function SequenceEditRows({edits, itemId, onSelectSymbol}: SequenceEditRowsProps) {
  const visible = edits.slice(0, MAX_VISIBLE_EDITS)
  const hidden = edits.length - visible.length

  return (
    <div className={css({pb: '1'})}>
      {visible.map((edit) => (
        <SequenceEditRow
          key={`${edit.type}:${edit.index}`}
          edit={edit}
          itemId={itemId}
          onSelectSymbol={onSelectSymbol}
        />
      ))}
      {hidden > 0 && (
        <p
          className={css({
            color: 'diffs.muted.foreground',
            pl: '8',
            pr: '3',
            py: '0.5',
            fontSize: 'xs',
            lineHeight: '[1rem]',
          })}
        >
          and {hidden} more
        </p>
      )}
    </div>
  )
}

interface SequenceEditRowProps {
  edit: SequenceEdit
  itemId: string
  onSelectSymbol?: (selection: SymbolSelection) => void
}

// One element-level edit under its owning key: `+ "lezer" at 9`. Same anatomy
// as a symbol row -- colored sigil, mono content -- one step indented and one
// step quieter.
function SequenceEditRow({edit, itemId, onSelectSymbol}: SequenceEditRowProps) {
  const style = edit.type === 'inserted' ? CHANGE_STYLES.added : CHANGE_STYLES.deleted
  const side = edit.type === 'inserted' ? 'additions' : 'deletions'

  return (
    <button
      type="button"
      disabled={isNullish(onSelectSymbol)}
      title={`${edit.type} at index ${edit.index}: ${edit.preview}`}
      className={css({
        display: 'flex',
        w: 'full',
        cursor: 'pointer',
        alignItems: 'baseline',
        gap: '2',
        pl: '8',
        pr: '3',
        py: '0.5',
        textAlign: 'left',
        outline: 'none',
        _hover: {bg: 'var(--diffs-card-hover-bg, rgb(0 0 0 / 0.04))'},
        _disabled: {cursor: 'default', _hover: {bg: 'transparent'}},
        _focusVisible: {boxShadow: '[inset 0 0 0 2px var(--ring)]'},
      })}
      onClick={() => onSelectSymbol?.({itemId, lineNumber: edit.range.startLine, side})}
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
        {edit.type === 'inserted' ? '+' : '−'}
      </span>
      <span
        className={css({
          minW: '0',
          fontFamily: 'diffs.mono',
          fontSize: 'xs',
          lineHeight: '[1rem]',
          wordBreak: 'break-all',
        })}
      >
        <span className={css({srOnly: true})}>{edit.type} </span>
        {edit.preview}
        <span className={css({color: 'diffs.muted.foreground'})}> at {edit.index}</span>
      </span>
    </button>
  )
}
