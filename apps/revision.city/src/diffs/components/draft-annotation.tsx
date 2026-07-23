import type {DiffLineAnnotation} from '@pierre/diffs'
import {IconArrowRight} from '@pierre/icons'
import {useEffect, useRef, useState} from 'react'

import {css, cx} from 'styled-system/css'
import {Button} from '@/diffs/components/button'
import {type AvatarName, annotationCardBase, getRandomPersona} from '@/diffs/lib/annotation'
import {isNullish} from '@/diffs/lib/nullish'
import type {DraftCommentMetadata} from '@/diffs/lib/types'
import {CommentAuthorAvatar} from './comment-author-avatar'

interface DraftAnnotationProps {
  annotation: DiffLineAnnotation<DraftCommentMetadata>
  itemId: string
  onCancel(itemId: string, key: string): void
  onSave(params: {itemId: string; key: string; message: string; author: AvatarName}): void
}

export function DraftAnnotation({annotation, itemId, onCancel, onSave}: DraftAnnotationProps) {
  const [message, setMessage] = useState(annotation.metadata.message)
  const [persona] = useState(getRandomPersona)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const trimmedMessage = message.trim()

  function handleSave() {
    if (trimmedMessage.length === 0) {
      return
    }
    onSave({itemId, key: annotation.metadata.key, message: trimmedMessage, author: persona.name})
  }

  function tryCancel() {
    if (trimmedMessage.length > 0 && !window.confirm('Discard this comment?')) {
      return
    }
    onCancel(itemId, annotation.metadata.key)
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (isNullish(textarea)) {
      return
    }

    textarea.focus({preventScroll: true})
    const cursorIndex = textarea.value.length
    textarea.setSelectionRange(cursorIndex, cursorIndex)
  }, [])

  return (
    <form
      className={cx(annotationCardBase, css({flexDirection: {base: 'column', md: 'row'}}))}
      onSubmit={(event) => {
        event.preventDefault()
        handleSave()
      }}
    >
      <div className={css({display: 'flex', w: 'full', gap: '2.5'})}>
        <CommentAuthorAvatar seed={persona.name} />
        <textarea
          ref={textareaRef}
          value={message}
          onChange={({currentTarget}) => setMessage(currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              tryCancel()
              return
            }

            if ((!event.shiftKey && !event.metaKey) || event.key !== 'Enter') {
              return
            }

            event.preventDefault()
            handleSave()
          }}
          placeholder="Add a comment…"
          rows={2}
          className={css({
            fieldSizing: 'content',
            w: 'full',
            resize: 'none',
            rounded: 'diffs.sm',
            bg: 'transparent',
            py: '1.5',
            fontSize: '14px',
            color: 'inherit',
            _placeholder: {
              color: 'var(--diffs-popover-muted-fg, var(--muted-foreground))',
            },
            _focus: {outline: 'none'},
          })}
        />
      </div>
      <div
        className={css({
          display: 'flex',
          w: {base: 'full', md: 'auto'},
          justifyContent: {base: 'space-between', md: 'flex-end'},
          gap: '3',
          // 10.5 isn't a step in Panda's default spacing scale (which skips
          // straight from 5.5 to 6); pl-10.5 in the original Tailwind (v4's
          // formula scale) resolves to 10.5 * 0.25rem, spelled out literally
          // here so it doesn't silently fall back to an unscaled `10.5px`.
          pl: {base: '2.625rem', md: '0'},
        })}
      >
        <Button
          type="button"
          variant="muted"
          onClick={tryCancel}
          className={css({
            color: 'diffs.muted.foreground',
            gap: '1',
            fontWeight: 'normal',
            display: {md: 'none'},
            '&[data-slot="button"]': {
              _hover: {color: 'diffs.foreground', textDecorationLine: 'none'},
            },
          })}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="default"
          size="icon-md"
          disabled={trimmedMessage.length === 0}
          className={css({
            display: {base: 'none', md: 'flex'},
            rounded: 'full',
            bg: 'blue.500',
            '&[data-slot="button"]': {_hover: {bg: 'blue.600'}},
          })}
        >
          <IconArrowRight className={css({w: '4', h: '4', transform: 'rotate(-90deg)'})} />
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={trimmedMessage.length === 0}
          className={css({
            display: {md: 'none'},
            gap: '1.5',
            bg: 'blue.500',
            '&[data-slot="button"]': {_hover: {bg: 'blue.600'}},
          })}
        >
          Submit
          <IconArrowRight className={css({mr: '-0.5', w: '3', h: '3'})} />
        </Button>
      </div>
    </form>
  )
}
