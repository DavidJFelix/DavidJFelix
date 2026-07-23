import type { DiffLineAnnotation } from '@pierre/diffs';
import { IconArrowRight } from '@pierre/icons';
import { useEffect, useRef, useState } from 'react';

import { css, cx } from 'styled-system/css';

import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import { Button } from '@/diffs/components/Button';
import {
  annotationCardBase,
  type AvatarName,
  getRandomPersona,
} from '@/diffs/lib/annotation';
import type { DraftCommentMetadata } from '@/diffs/lib/types';

interface DraftAnnotationProps {
  annotation: DiffLineAnnotation<DraftCommentMetadata>;
  itemId: string;
  onCancel(itemId: string, key: string): void;
  onSave(
    itemId: string,
    key: string,
    message: string,
    author: AvatarName
  ): void;
}

export function DraftAnnotation({
  annotation,
  itemId,
  onCancel,
  onSave,
}: DraftAnnotationProps) {
  const [message, setMessage] = useState(annotation.metadata.message);
  const [persona] = useState(getRandomPersona);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedMessage = message.trim();

  function handleSave() {
    if (trimmedMessage.length === 0) {
      return;
    }
    onSave(itemId, annotation.metadata.key, trimmedMessage, persona.name);
  }

  function tryCancel() {
    if (trimmedMessage.length > 0 && !window.confirm('Discard this comment?')) {
      return;
    }
    onCancel(itemId, annotation.metadata.key);
  }

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea == null) {
      return;
    }

    textarea.focus({ preventScroll: true });
    const cursorIndex = textarea.value.length;
    textarea.setSelectionRange(cursorIndex, cursorIndex);
  }, []);

  return (
    <form
      className={cx(
        annotationCardBase,
        css({ flexDirection: { base: 'column', md: 'row' } })
      )}
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <div className={css({ display: 'flex', w: 'full', gap: '2.5' })}>
        <CommentAuthorAvatar seed={persona.name} />
        <textarea
          ref={textareaRef}
          value={message}
          onChange={({ currentTarget }) => setMessage(currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              tryCancel();
              return;
            }

            if ((!event.shiftKey && !event.metaKey) || event.key !== 'Enter') {
              return;
            }

            event.preventDefault();
            handleSave();
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
            _focus: { outline: 'none' },
          })}
        />
      </div>
      <div
        className={css({
          display: 'flex',
          w: { base: 'full', md: 'auto' },
          justifyContent: { base: 'space-between', md: 'flex-end' },
          gap: '3',
          pl: { base: '10.5', md: '0' },
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
            display: { md: 'none' },
            '&[data-slot="button"]': {
              _hover: { color: 'diffs.foreground', textDecorationLine: 'none' },
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
            display: { base: 'none', md: 'flex' },
            rounded: 'full',
            bg: 'blue.500',
            '&[data-slot="button"]': { _hover: { bg: 'blue.600' } },
          })}
        >
          <IconArrowRight
            className={css({ w: '4', h: '4', transform: 'rotate(-90deg)' })}
          />
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={trimmedMessage.length === 0}
          className={css({
            display: { md: 'none' },
            gap: '1.5',
            bg: 'blue.500',
            '&[data-slot="button"]': { _hover: { bg: 'blue.600' } },
          })}
        >
          Submit
          <IconArrowRight
            className={css({ mr: '-0.5', w: '3', h: '3' })}
          />
        </Button>
      </div>
    </form>
  );
}
