import { css, cx } from 'styled-system/css';

import { getCommentPersona } from '@/diffs/lib/annotation';

interface CommentAuthorAvatarProps {
  // A stable seed (e.g. comment key or a fixed name) used to pick the persona.
  seed: string;
  className?: string;
}

// Renders a circular initial-letter avatar for a comment author. Defaults to
// 32px; pass className to override for other sizes.
export function CommentAuthorAvatar({
  seed,
  className,
}: CommentAuthorAvatarProps) {
  const { name, color, initial } = getCommentPersona(seed);
  return (
    <div
      className={css({
        position: 'relative',
        flexShrink: '0',
        alignSelf: 'flex-start',
        _after: {
          position: 'absolute',
          inset: '0',
          zIndex: '10',
          display: 'block',
          rounded: 'full',
          borderWidth: '1px',
          borderColor: 'rgb(0 0 0 / 0.1)',
          content: '""',
          _dark: { borderColor: 'rgb(255 255 255 / 0.1)' },
        },
      })}
    >
      <span
        role="img"
        aria-label={name}
        style={{ backgroundColor: color }}
        className={cx(
          css({
            display: 'flex',
            w: '8',
            h: '8',
            alignItems: 'center',
            justifyContent: 'center',
            rounded: 'full',
            color: 'white',
            fontSize: 'sm',
            lineHeight: '1',
            fontWeight: 'semibold',
            userSelect: 'none',
          }),
          className
        )}
      >
        {initial}
      </span>
    </div>
  );
}
