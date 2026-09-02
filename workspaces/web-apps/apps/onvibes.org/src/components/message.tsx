import {Sparkle} from 'lucide-react'
import type {Ref} from 'react'
import {css} from 'styled-system/css'
import type {Message} from '@/lib/conversations'

// Two voices, one hue: the assistant speaks in plain text beside a small mark,
// the user in an inverted bubble aligned to the end. Both keep the same
// measure so a reply never reads wider than the question above it.
const assistantClass = css({
  display: 'flex',
  gap: '3',
  alignItems: 'flex-start',
  maxW: '[85%]',
})

const markClass = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  w: '7',
  h: '7',
  mt: '0.5',
  rounded: 'full',
  borderWidth: '1px',
  borderColor: 'border',
  color: 'text.muted',
})

const userClass = css({
  alignSelf: 'flex-end',
  maxW: '[85%]',
  px: '4',
  py: '2.5',
  rounded: '2xl',
  borderEndEndRadius: 'md',
  bg: 'inverse.bg',
  color: 'inverse.text',
})

const bodyClass = css({
  fontSize: 'md',
  lineHeight: 'relaxed',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
})

export interface MessageBubbleProps {
  message: Message
  ref?: Ref<HTMLDivElement>
}

export function MessageBubble({message, ref}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div ref={ref} className={userClass} data-role="user">
        <p className={bodyClass}>{message.text}</p>
      </div>
    )
  }
  return (
    <div ref={ref} className={assistantClass} data-role="assistant">
      <span className={markClass}>
        <Sparkle size={14} />
      </span>
      <p className={bodyClass}>{message.text}</p>
    </div>
  )
}
