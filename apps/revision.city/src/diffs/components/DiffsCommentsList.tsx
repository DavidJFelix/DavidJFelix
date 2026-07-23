// cSpell:ignore ochin Convo -- theme/icon names
import type { AnnotationSide } from '@pierre/diffs';
import { IconConvoFill, IconPlus } from '@pierre/icons';
import { memo, type MouseEvent } from 'react';

import { css, cx } from 'styled-system/css';

import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import type {
  CommentLineType,
  DiffsSavedCommentEntry,
  DiffsSavedCommentItem,
} from '@/diffs/lib/types';

interface DiffsCommentsListProps {
  commentSections: readonly DiffsSavedCommentItem[];
  onSelectComment?(comment: DiffsSavedCommentEntry): void;
  onSelectItem?(itemId: string): void;
}

function getCommentLineLabel(
  side: AnnotationSide,
  lineNumber: number,
  lineType: CommentLineType
): string {
  if (lineType === 'context') {
    return `Line ${lineNumber}`;
  }
  const sigil = side === 'additions' ? '+' : '-';
  return `Line ${sigil}${lineNumber}`;
}

function getCommentLineClassName(
  side: AnnotationSide,
  lineType: CommentLineType
): string {
  if (lineType === 'context') {
    return css({ color: 'diffs.muted.foreground' });
  }
  // The themed chrome sets --diffs-comment-add-fg / -del-fg with a shade
  // chosen from the active Shiki surface's luminance, so addition/deletion
  // labels stay legible even on mixed-palette themes (e.g. slack-ochin's
  // "light" classification with a dark navy sidebar, where the global
  // `dark:` variant would otherwise leave us with low-contrast 700 shades
  // on a dark card). The Tailwind shades stay as fallbacks for the
  // first-render window before the chrome style applies.
  return side === 'additions'
    ? css({
        color: 'var(--diffs-comment-add-fg, #047857)',
        _dark: { color: 'var(--diffs-comment-add-fg, #34d399)' },
      })
    : css({
        color: 'var(--diffs-comment-del-fg, #be123c)',
        _dark: { color: 'var(--diffs-comment-del-fg, #fb7185)' },
      });
}

// Wraps a click handler so users can drag-select text inside the row without
// also triggering navigation. mouseup after a selection fires click on the
// button; bail out only when the resulting selection is anchored inside this
// row, so a pre-existing selection elsewhere on the page (e.g. in the diff
// viewer) does not block keyboard/mouse activation of the row.
function handleRowClick(
  event: MouseEvent<HTMLButtonElement>,
  run: () => void
): void {
  if (event.button !== 0) {
    return;
  }
  const selection =
    typeof window !== 'undefined' ? window.getSelection() : null;
  if (selection != null && selection.toString().length > 0) {
    const row = event.currentTarget;
    const anchorInRow =
      selection.anchorNode != null && row.contains(selection.anchorNode);
    const focusInRow =
      selection.focusNode != null && row.contains(selection.focusNode);
    if (anchorInRow || focusInRow) {
      event.preventDefault();
      return;
    }
  }
  run();
}

export const DiffsCommentsList = memo(function DiffsCommentsList({
  commentSections,
  onSelectComment,
  onSelectItem,
}: DiffsCommentsListProps) {
  if (commentSections.length === 0) {
    return (
      <div
        className={css({
          color: 'diffs.muted.foreground',
          display: 'flex',
          h: 'full',
          minH: '0',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2',
          px: '7',
          textAlign: 'center',
          fontSize: 'sm',
          lineHeight: '1.25rem',
        })}
      >
        <IconConvoFill size={24} className={css({ mb: '2' })} />
        <div className={css({ display: 'flex', flexDirection: 'column' })}>
          <strong className={css({ fontWeight: 'medium' })}>
            No comments yet
          </strong>
          <p>
            Hover over a line and click the{' '}
            <span
              className={css({
                display: 'inline-flex',
                h: '20px',
                w: '20px',
                alignItems: 'center',
                justifyContent: 'center',
                rounded: '4px',
                verticalAlign: 'top',
                _light: { color: 'white', bg: 'rgb(0, 159, 255)' },
                _dark: { bg: 'rgb(0, 159, 255)', color: 'black' },
              })}
            >
              <IconPlus />
            </span>{' '}
            button to add fake code comments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        'cv-mini-scrollbar',
        css({
          h: 'full',
          minH: '0',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          pl: '3',
          pb: '3',
          pr: 'max(0px, calc(12px - var(--cv-mini-gutter-vertical)))',
        })
      )}
    >
      {commentSections.map((section) => (
        <section key={section.itemId}>
          {onSelectItem != null ? (
            <button
              type="button"
              className={css({
                color: 'diffs.muted.foreground',
                _hover: { color: 'diffs.foreground' },
                display: 'block',
                w: 'full',
                cursor: 'pointer',
                p: '3',
                pb: '2',
                textAlign: 'left',
                fontSize: 'sm',
                lineHeight: '1.25rem',
                fontWeight: 'medium',
                wordBreak: 'break-all',
                outline: 'none',
                _focusVisible: { boxShadow: '0 0 0 2px var(--ring)' },
              })}
              onClick={(event) =>
                handleRowClick(event, () => onSelectItem(section.itemId))
              }
            >
              <span className={css({ userSelect: 'text' })}>
                {section.path}
              </span>
            </button>
          ) : (
            <div
              className={css({
                color: 'diffs.muted.foreground',
                p: '3',
                pb: '2',
                fontSize: 'sm',
                lineHeight: '1.25rem',
                fontWeight: 'medium',
                wordBreak: 'break-all',
              })}
            >
              {section.path}
            </div>
          )}
          <div
            className={css({
              rounded: 'diffs.lg',
              borderWidth: '1px',
              borderColor: 'var(--diffs-card-border, rgb(0 0 0 / 0.1))',
              _dark: {
                borderColor: 'var(--diffs-card-border, rgb(255 255 255 / 0.15))',
              },
            })}
          >
            {section.comments.map((comment) => (
              <button
                key={comment.key}
                type="button"
                // Card surface, hover, and border come from the themed
                // chrome (set on the sidebar wrapper) so cards stay
                // on-palette for mixed-light/dark themes like slack-ochin
                // (light-typed but uses a dark navy sidebar). The
                // hardcoded fallbacks cover the brief window before the
                // Shiki theme resolves on first render.
                // No `transition-colors` here: the bg / border / text
                // colors are driven by CSS variables that flip the entire
                // chrome on every theme swap, so a smooth color transition
                // on each card visibly trails the rest of the UI (header,
                // file tree, diff body) which snap instantly. Hover bg is
                // snappy enough without an interpolated transition.
                className={css({
                  display: 'flex',
                  w: 'full',
                  cursor: 'pointer',
                  alignItems: 'flex-start',
                  gap: '2',
                  borderBottomWidth: '1px',
                  borderColor: 'var(--diffs-card-border, rgb(0 0 0 / 0.1))',
                  bg: 'var(--diffs-card-bg, var(--card))',
                  p: '3',
                  textAlign: 'left',
                  fontSize: 'sm',
                  lineHeight: '1.25rem',
                  outline: 'none',
                  _first: { roundedTop: 'diffs.lg' },
                  _last: { roundedBottom: 'diffs.lg', borderBottomWidth: '0' },
                  _hover: { bg: 'var(--diffs-card-hover-bg, var(--muted))' },
                  _focusVisible: { boxShadow: '0 0 0 2px var(--ring)' },
                  _dark: {
                    borderColor:
                      'var(--diffs-card-border, rgb(255 255 255 / 0.15))',
                  },
                })}
                onClick={(event) =>
                  handleRowClick(event, () => onSelectComment?.(comment))
                }
              >
                <CommentAuthorAvatar
                  seed={comment.author}
                  className={css({ w: '5', h: '5' })}
                />
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.5',
                    userSelect: 'text',
                  })}
                >
                  <div
                    className={css({
                      color: 'diffs.muted.foreground',
                      display: 'flex',
                      gap: '1',
                    })}
                  >
                    {comment.author} commented on{' '}
                    <span
                      className={cx(
                        getCommentLineClassName(comment.side, comment.lineType),
                        css({ fontWeight: 'medium' })
                      )}
                    >
                      {getCommentLineLabel(
                        comment.side,
                        comment.lineNumber,
                        comment.lineType
                      )}
                    </span>
                  </div>
                  <p
                    className={css({
                      color: 'diffs.foreground',
                      w: 'full',
                      overflowWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                    })}
                  >
                    {comment.message}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});
