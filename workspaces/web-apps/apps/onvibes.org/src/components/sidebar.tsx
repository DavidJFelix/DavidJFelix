import {Plus, X} from 'lucide-react'
import {useEffect, useState} from 'react'
import {css} from 'styled-system/css'
import {IconButton} from '@/components/icon-button'
import {type Conversation, formatRelativeTime, previewOf} from '@/lib/conversations'
import {ThemeToggle} from '@/theme/theme-toggle'

const rowClass = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  columnGap: '3',
  rowGap: '0.5',
  alignItems: 'baseline',
  w: 'full',
  px: '3',
  py: '2.5',
  rounded: 'lg',
  textAlign: 'start',
  cursor: 'pointer',
  transition: 'colors',
  _hover: {bg: 'bg.hover'},
  _focusVisible: {outline: '[2px solid]', outlineColor: 'focus.ring', outlineOffset: '[-2px]'},
  '&[aria-current=true]': {bg: 'bg.selected'},
})

const truncate = css({
  minW: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

interface ConversationRowProps {
  conversation: Conversation
  active: boolean
  now: number
  onSelect: () => void
}

function ConversationRow({conversation, active, now, onSelect}: ConversationRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={rowClass}
      >
        <span className={`${truncate} ${css({fontSize: 'sm', fontWeight: 'medium'})}`}>
          {conversation.title}
        </span>
        <span
          className={css({fontSize: 'xs', color: 'text.muted', fontVariantNumeric: 'tabular-nums'})}
        >
          {formatRelativeTime({updatedAt: conversation.updatedAt, now})}
        </span>
        <span
          className={`${truncate} ${css({gridColumn: '1 / -1', fontSize: 'xs', color: 'text.muted'})}`}
        >
          {previewOf(conversation)}
        </span>
      </button>
    </li>
  )
}

export interface SidebarProps {
  conversations: ReadonlyArray<Conversation>
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  // Small screens only: the sidebar is a drawer and needs its own close.
  onClose: () => void
}

const CLOCK_TICK_MS = 30_000

// The clock behind the age labels: one reading shared by every row, refreshed
// often enough that a row never shows 'now' for long after it stopped being
// true. Read in state (not during render) so SSR and hydration agree.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function Sidebar({conversations, activeId, onSelect, onNew, onClose}: SidebarProps) {
  const now = useNow()
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        h: 'full',
        bg: 'bg.surface',
        borderInlineEndWidth: '1px',
        borderColor: 'border',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          ps: '4',
          pe: '2',
          h: '14',
          flexShrink: '0',
        })}
      >
        <span
          className={css({
            flex: '1',
            fontWeight: 'semibold',
            fontSize: 'md',
            letterSpacing: 'tight',
          })}
        >
          onvibes.org
        </span>
        <IconButton label="New conversation" onClick={onNew}>
          <Plus size={18} />
        </IconButton>
        <IconButton
          label="Close sidebar"
          onClick={onClose}
          className={css({md: {display: 'none'}})}
        >
          <X size={18} />
        </IconButton>
      </div>

      <nav aria-label="Conversations" className={css({flex: '1', minH: '0', overflowY: 'auto'})}>
        <ul
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5',
            listStyleType: 'none',
            m: '0',
            p: '2',
          })}
        >
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              now={now}
              onSelect={() => onSelect(conversation.id)}
            />
          ))}
        </ul>
      </nav>

      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '3',
          px: '4',
          py: '3',
          borderTopWidth: '1px',
          borderColor: 'border',
          fontSize: 'xs',
          color: 'text.muted',
        })}
      >
        <span>Apps, built on vibes.</span>
        <ThemeToggle />
      </div>
    </div>
  )
}
