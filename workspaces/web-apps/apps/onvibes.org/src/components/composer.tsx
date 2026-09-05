import {ArrowUp, Square} from 'lucide-react'
import {type FormEvent, type KeyboardEvent, useId, useState} from 'react'
import {css} from 'styled-system/css'
import {IconButton} from '@/components/icon-button'

const MAX_HEIGHT_PX = 240

// Outer 2xl radius with 2 (8px) padding keeps the inner lg send button
// concentric.
const frameClass = css({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2',
  p: '2',
  ps: '4',
  rounded: '2xl',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'bg.canvas',
  cursor: 'text',
  transition: 'colors',
  _focusWithin: {borderColor: 'focus.ring'},
})

const textareaClass = css({
  flex: '1',
  minH: '9',
  py: '1.5',
  fontSize: 'md',
  lineHeight: 'normal',
  color: 'text',
  bg: 'transparent',
  resize: 'none',
  outline: 'none',
  _placeholder: {color: 'text.muted'},
})

export interface ComposerProps {
  onSend: (text: string) => void
  // While a reply is on its way the one button stops it instead of sending,
  // and Enter waits: the draft stays put until the reply lands or is stopped.
  busy?: boolean
  onStop?: () => void
}

export function Composer({onSend, busy = false, onStop}: ComposerProps) {
  const [draft, setDraft] = useState('')
  const labelId = useId()
  const text = draft.trim()

  // Fit the textarea to its content. A callback ref runs after the DOM holds
  // the latest value, so it needs no effect and no dependency list -- but only
  // when React sees a new function, which is why it is created per render
  // rather than hoisted: a stable ref would run once, on mount, and never
  // follow the draft.
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }

  const submit = () => {
    if (busy || text.length === 0) return
    onSend(text)
    setDraft('')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit()
  }

  // Enter sends, Shift+Enter breaks the line -- the chat convention.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className={frameClass}>
      <label htmlFor={labelId} className={css({srOnly: true})}>
        Message
      </label>
      <textarea
        id={labelId}
        ref={autosize}
        rows={1}
        value={draft}
        placeholder="Describe the app you want to build"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        className={textareaClass}
      />
      {busy ? (
        <IconButton label="Stop generating" variant="primary" onClick={onStop}>
          <Square size={14} fill="currentColor" />
        </IconButton>
      ) : (
        <IconButton
          label="Send message"
          type="submit"
          variant="primary"
          disabled={text.length === 0}
        >
          <ArrowUp size={18} />
        </IconButton>
      )}
    </form>
  )
}
