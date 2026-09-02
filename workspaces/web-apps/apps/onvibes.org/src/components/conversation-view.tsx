import {PanelLeft} from 'lucide-react'
import {css} from 'styled-system/css'
import {Composer} from '@/components/composer'
import {IconButton} from '@/components/icon-button'
import {MessageBubble} from '@/components/message'
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

export interface ConversationViewProps {
  conversation: Conversation
  onSend: (text: string) => void
  onOpenSidebar: () => void
}

// Keep the newest message in view. Attached only to the last bubble, and with
// a stable identity, so React invokes it exactly when a new last message
// mounts -- a send, or a different conversation being selected.
function scrollIntoView(el: HTMLDivElement | null) {
  el?.scrollIntoView({block: 'end'})
}

export function ConversationView({conversation, onSend, onOpenSidebar}: ConversationViewProps) {
  const count = conversation.messages.length

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
                ref={index === count - 1 ? scrollIntoView : undefined}
              />
            ))}
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
          <Composer onSend={onSend} />
        </div>
      </div>
    </main>
  )
}
