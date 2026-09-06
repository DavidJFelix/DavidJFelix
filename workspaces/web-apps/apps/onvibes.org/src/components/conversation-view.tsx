import {PanelLeft, Sparkle} from 'lucide-react'
import {css} from 'styled-system/css'
import {Composer} from '@/components/composer'
import {IconButton} from '@/components/icon-button'
import {MessageBubble, markClass} from '@/components/message'
import type {Conversation} from '@/lib/conversations'

// Shared measure for the message column and the composer so they line up.
const columnClass = css({w: 'full', maxW: '3xl', mx: 'auto', px: {base: '4', md: '6'}})

function EmptyState() {
  return (
    <div
      className={css({
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2',
        textAlign: 'center',
        px: '6',
      })}
    >
      <p className={css({fontSize: 'lg', fontWeight: 'medium', letterSpacing: 'tight'})}>
        What do you want to build?
      </p>
      <p className={css({fontSize: 'sm', color: 'text.muted', maxW: 'sm', lineHeight: 'relaxed'})}>
        Describe an app in a sentence or two. The conversation takes its name from your first
        message.
      </p>
    </div>
  )
}

// Holds the assistant's place between the send and the first token, in the
// assistant's own layout so the reply lands where the dots were.
function PendingReply() {
  return (
    <output
      aria-label="Waiting for a reply"
      className={css({display: 'flex', gap: '3', alignItems: 'flex-start'})}
    >
      <span className={markClass}>
        <Sparkle size={14} />
      </span>
      <p className={css({fontSize: 'md', lineHeight: 'relaxed', color: 'text.muted'})}>…</p>
    </output>
  )
}

interface ReplyFailedProps {
  message: string
  onRetry?: () => void
}

function ReplyFailed({message, onRetry}: ReplyFailedProps) {
  return (
    <div
      role="alert"
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: '3',
        ps: '10',
        fontSize: 'sm',
        color: 'text.muted',
      })}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className={css({
          color: 'text',
          fontWeight: 'medium',
          textDecoration: 'underline',
          textUnderlineOffset: '[0.2em]',
          cursor: 'pointer',
          _focusVisible: {
            outline: '[2px solid]',
            outlineColor: 'focus.ring',
            outlineOffset: '[2px]',
          },
        })}
      >
        Try again
      </button>
    </div>
  )
}

export interface ConversationViewProps {
  conversation: Conversation
  // A reply is on its way: the composer offers stop, the thread follows the
  // stream, and a placeholder holds the assistant's place until the first token.
  busy?: boolean
  // The last reply failed; the copy is already user-facing.
  error?: string
  onSend: (text: string) => void
  onStop?: () => void
  onRetry?: () => void
  onOpenSidebar: () => void
}

// Keep the newest message in view. Attached only to the last bubble, and with
// a stable identity, so React invokes it exactly when a new last message
// mounts -- a send, or a different conversation being selected.
function scrollIntoView(el: HTMLDivElement | null) {
  el?.scrollIntoView({block: 'end'})
}

export function ConversationView({
  conversation,
  busy = false,
  error,
  onSend,
  onStop,
  onRetry,
  onOpenSidebar,
}: ConversationViewProps) {
  const count = conversation.messages.length
  const awaitingReply = busy && conversation.messages.at(-1)?.role === 'user'

  // While a reply streams the last bubble grows in place rather than mounting,
  // so a per-render ref (a new function each time, which React re-invokes)
  // keeps following it; once settled the stable ref takes over again.
  const followLast = busy ? (el: HTMLDivElement | null) => scrollIntoView(el) : scrollIntoView

  return (
    <main
      className={css({
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        minW: '0',
        h: 'full',
        bg: 'bg.canvas',
      })}
    >
      <header
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          h: '14',
          flexShrink: '0',
          ps: {base: '2', md: '6'},
          pe: '4',
          borderBottomWidth: '1px',
          borderColor: 'border',
        })}
      >
        <IconButton
          label="Open sidebar"
          onClick={onOpenSidebar}
          className={css({md: {display: 'none'}})}
        >
          <PanelLeft size={18} />
        </IconButton>
        <h1
          className={css({
            minW: '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'md',
            fontWeight: 'semibold',
            letterSpacing: 'tight',
          })}
        >
          {conversation.title}
        </h1>
      </header>

      <div className={css({flex: '1', minH: '0', overflowY: 'auto'})}>
        {count === 0 ? (
          <div className={css({display: 'flex', h: 'full'})}>
            <EmptyState />
          </div>
        ) : (
          <div
            className={`${columnClass} ${css({display: 'flex', flexDirection: 'column', gap: '6', py: '8'})}`}
          >
            {conversation.messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                ref={index === count - 1 ? followLast : undefined}
              />
            ))}
            {awaitingReply && <PendingReply />}
            {error !== undefined && <ReplyFailed message={error} onRetry={onRetry} />}
          </div>
        )}
      </div>

      <div
        className={css({
          flexShrink: '0',
          pt: '2',
          pb: '[calc(token(spacing.4) + env(safe-area-inset-bottom))]',
        })}
      >
        <div className={columnClass}>
          <Composer onSend={onSend} busy={busy} onStop={onStop} />
        </div>
      </div>
    </main>
  )
}
