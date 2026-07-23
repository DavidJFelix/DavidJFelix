import type {CodeViewLineSelection, DiffLineAnnotation} from '@pierre/diffs'
import {IconX} from '@pierre/icons'
import {memo} from 'react'

import {css, cx} from 'styled-system/css'
import {Button} from '@/diffs/components/button'
import {annotationCardBase} from '@/diffs/lib/annotation'
import type {SavedCommentMetadata} from '@/diffs/lib/types'
import {CommentAuthorAvatar} from './comment-author-avatar'

interface ExampleAnnotationProps {
  annotation: DiffLineAnnotation<SavedCommentMetadata>
  itemId: string
  onDelete(itemId: string, key: string): void
  onToggleSelection(selection: CodeViewLineSelection): void
}

// The card is a plain container with a real <button> as its click surface;
// the delete Button sits outside that button as a sibling, since nesting
// native buttons is invalid HTML (upstream used role="button" on the card
// instead, which trades away native semantics).
export const ExampleAnnotation = memo(function ExampleAnnotation({
  annotation,
  itemId,
  onDelete,
  onToggleSelection,
}: ExampleAnnotationProps) {
  const selection = {id: itemId, range: annotation.metadata.range}
  return (
    <div
      className={cx(
        annotationCardBase,
        'group',
        css({
          position: 'relative',
          _hover: {
            borderColor:
              'var(--diffs-annotation-hover-border, var(--diffs-annotation-border, var(--border)))',
          },
        }),
      )}
    >
      <button
        type="button"
        aria-label="Toggle line selection for this comment"
        className={css({
          display: 'flex',
          w: 'full',
          gap: '2.5',
          bg: 'transparent',
          p: '0',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
        })}
        onClick={() => onToggleSelection(selection)}
      >
        <CommentAuthorAvatar seed={annotation.metadata.author} />
        <span className={css({display: 'flex', flexDirection: 'column'})}>
          <strong className={css({mt: '1', display: 'block', fontSize: '14px'})}>
            {annotation.metadata.author}
          </strong>
          <span className={css({m: '0', fontSize: '14px', whiteSpace: 'pre-wrap'})}>
            {annotation.metadata.message}
          </span>
        </span>
      </button>
      <Button
        variant="default"
        size="icon-sm"
        aria-label="Delete comment"
        onClick={(event) => {
          event.stopPropagation()
          onDelete(itemId, annotation.metadata.key)
        }}
        className={css({
          pointerEvents: 'none',
          position: 'absolute',
          top: '0',
          right: '0',
          zIndex: '1',
          display: 'inline-flex',
          transform: 'translateX(35%) translateY(-35%)',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          rounded: 'full',
          bg: 'neutral.500',
          opacity: '0',
          boxShadow: 'inherit',
          transition: 'opacity 100ms cubic-bezier(0.4, 0, 0.2, 1)',
          // Revealed when the annotation card (the `.group` ancestor above) is
          // hovered, mirroring the original group-hover utilities.
          _groupHover: {pointerEvents: 'auto', opacity: '1'},
        })}
      >
        <IconX size={12} />
      </Button>
    </div>
  )
})
