import type { CodeViewLineSelection, DiffLineAnnotation } from '@pierre/diffs';
import { IconX } from '@pierre/icons';
import { memo } from 'react';

import { css, cx } from 'styled-system/css';

import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import { Button } from '@/diffs/components/Button';
import { annotationCardBase } from '@/diffs/lib/annotation';
import type { SavedCommentMetadata } from '@/diffs/lib/types';

interface ExampleAnnotationProps {
  annotation: DiffLineAnnotation<SavedCommentMetadata>;
  itemId: string;
  onDelete(itemId: string, key: string): void;
  onToggleSelection(selection: CodeViewLineSelection): void;
}

export const ExampleAnnotation = memo(function ExampleAnnotation({
  annotation,
  itemId,
  onDelete,
  onToggleSelection,
}: ExampleAnnotationProps) {
  const selection = { id: itemId, range: annotation.metadata.range };
  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(
        annotationCardBase,
        'group',
        css({
          position: 'relative',
          cursor: 'pointer',
          _hover: {
            borderColor:
              'var(--diffs-annotation-hover-border, var(--diffs-annotation-border, var(--border)))',
          },
        })
      )}
      onClick={() => onToggleSelection(selection)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        onToggleSelection(selection);
      }}
    >
      <CommentAuthorAvatar seed={annotation.metadata.author} />
      <Button
        variant="default"
        size="icon-sm"
        aria-label="Delete comment"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(itemId, annotation.metadata.key);
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
          // PORT-TODO: the original Tailwind also had
          // `group-hover:pointer-events-auto group-hover:opacity-100`, revealing
          // this delete button when the card (`.group`, set above) is hovered.
          // Per the port brief, group-hover is flagged rather than implemented
          // here, so as converted this button stays permanently hidden
          // (opacity 0, pointer-events none). Restoring the reveal needs a
          // manual ancestor selector, e.g. `'.group:hover &': { pointerEvents:
          // 'auto', opacity: '1' }` (same pattern as Toaster.tsx's `.toaster &`).
        })}
      >
        <IconX size={12} />
      </Button>
      <div className={css({ display: 'flex', flexDirection: 'column' })}>
        <strong className={css({ mt: '1', display: 'block', fontSize: '14px' })}>
          {annotation.metadata.author}
        </strong>
        <p className={css({ m: '0', fontSize: '14px', whiteSpace: 'pre-wrap' })}>
          {annotation.metadata.message}
        </p>
      </div>
    </div>
  );
});
