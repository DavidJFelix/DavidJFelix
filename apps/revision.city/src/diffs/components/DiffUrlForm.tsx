import { useStableCallback } from '@pierre/diffs/react';
import { IconX } from '@pierre/icons';
import { useRouter } from '@tanstack/react-router';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/diffs/components/Button';
import { getPatchViewerHref } from '@/diffs/lib/get-patch-viewer-href';
import { css, cx } from 'styled-system/css';

interface DiffUrlFormProps {
  className?: string;
  // When provided, the input restores to this value on blur or Escape. Also
  // controls the clear-button visibility: with an initialUrl set, the clear
  // button only shows when the input matches the committed URL or has an error
  // (i.e. not while the user is typing). Without an initialUrl the clear
  // button shows whenever the input has content.
  initialUrl?: string;
  inputClassName?: string;
  // Called whenever the controlled URL value changes, so parent components
  // can react to edits (e.g. to conditionally show/hide related controls).
  onUrlChange?: (url: string) => void;
  placeholder?: string;
  // Render prop for the submit button area. Receives the transition pending
  // state and current URL value so callers can conditionally render controls.
  children?: (isPending: boolean, url: string) => ReactNode;
}

// Shared URL input form used in both the viewer header and the home page.
// Handles URL state, validation via getPatchViewerHref, router navigation,
// the validation error popover (portal-based to escape contain-paint), and
// escape/blur restore behavior.
export function DiffUrlForm({
  className,
  initialUrl = '',
  inputClassName,
  onUrlChange,
  placeholder,
  children,
}: DiffUrlFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [url, setURL] = useState(initialUrl);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Tracks the input's viewport position when an error is shown so the portal
  // can be fixed-positioned outside any contain-paint boundary.
  const [errorAnchor, setErrorAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);
  // Preserves the last message so the popover still has content while fading out.
  const lastErrorText = useRef<string | null>(null);
  // Prevents the onBlur restore from firing when blur is caused by Enter.
  const isSubmittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setURL(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    onUrlChange?.(url);
  }, [onUrlChange, url]);

  // Keep the portal position in sync with the input whenever it's visible.
  // Resize (including DevTools opening) and scroll both change the input's
  // viewport position, so we re-measure on those events.
  useEffect(() => {
    if (errorAnchor === null) return;

    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect != null) setErrorAnchor({ top: rect.bottom, left: rect.left });
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [errorAnchor]);

  const handleSubmit = useStableCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      isSubmittingRef.current = false;
      const normalizedURL = url.trim();
      const viewerHref = getPatchViewerHref(normalizedURL);
      if (viewerHref == null) {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect != null) setErrorAnchor({ top: rect.bottom, left: rect.left });
        lastErrorText.current = 'Please enter a valid URL';
        setValidationError('Please enter a valid URL');
        return;
      }
      setValidationError(null);
      setURL(normalizedURL);
      startTransition(() => {
        router.history.push(viewerHref);
      });
    }
  );

  // Show the clear button when the input has content. When an initialUrl is
  // set (viewer header), hide it while the user is actively editing so it
  // doesn't distract — restore it once committed or on error.
  const showClear =
    url.length > 0 &&
    (initialUrl === '' || url === initialUrl || validationError !== null);

  return (
    <form
      className={cx(
        'group',
        css({
          display: 'flex',
          minW: '0',
          alignItems: 'center',
          gap: '1',
          w: 'full',
          overflow: 'hidden',
        }),
        className
      )}
      noValidate
      onSubmit={handleSubmit}
    >
      <input
        ref={inputRef}
        className={cx(
          css({
            _focus: { color: 'diffs.primary' },
            display: 'block',
            fieldSizing: 'content',
            h: '9',
            minW: '24ch',
            rounded: 'diffs.md',
            fontSize: 'sm',
            lineHeight: '1.25rem',
            _focusVisible: { outline: 'none' },
          }),
          inputClassName
        )}
        enterKeyHint="go"
        value={url}
        type="url"
        onChange={({ currentTarget }) => {
          setURL(currentTarget.value);
          if (validationError) setValidationError(null);
        }}
        onBlur={() => {
          if (isSubmittingRef.current) return;
          // Only restore the committed URL when the field is empty — if the
          // user typed something and clicked away, keep their draft.
          if (url.trim() === '') {
            setURL(initialUrl);
            setValidationError(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setURL(initialUrl);
            setValidationError(null);
            inputRef.current?.blur();
          } else if (e.key === 'Enter') {
            isSubmittingRef.current = true;
          }
        }}
        placeholder={placeholder}
      />
      {showClear && (
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          aria-label="Clear"
          // Hidden until the form is hovered/focused (half opacity), full
          // affordance on direct hover. Direct hover always coincides with
          // group hover, so it needs strictly higher specificity than the
          // group rules to win deterministically — the compound
          // `.group ... &:hover` selector provides that.
          className={css({
            opacity: '0',
            transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'auto',
            _groupFocusWithin: { opacity: '0.5' },
            _groupHover: { opacity: '0.5' },
            '&:hover:is(.group:is(:hover, [data-hover]) *, .group:focus-within *)':
              { opacity: '0.75' },
          })}
          onClick={() => {
            setURL('');
            setValidationError(null);
            inputRef.current?.focus();
          }}
        >
          <IconX className={css({ w: '4', h: '4' })} />
        </Button>
      )}
      {children?.(isPending, url)}
      {/* Hidden submit ensures Enter triggers form submission in all browsers */}
      <button type="submit" hidden />
      {errorAnchor !== null &&
        createPortal(
          <div
            aria-live="polite"
            style={{ top: errorAnchor.top + 8, left: errorAnchor.left }}
            className={cx(
              css({
                bg: 'diffs.foreground',
                color: 'diffs.background',
                pointerEvents: 'none',
                position: 'fixed',
                zIndex: '50',
                rounded: 'diffs.md',
                px: '3',
                py: '1.5',
                fontSize: 'xs',
                lineHeight: '1rem',
                transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              }),
              validationError !== null
                ? css({ opacity: '1' })
                : css({ opacity: '0' })
            )}
            onTransitionEnd={() => {
              if (validationError === null) setErrorAnchor(null);
            }}
          >
            <div
              className={css({
                bg: 'diffs.foreground',
                position: 'absolute',
                top: '-1',
                left: '3',
                w: '2.5',
                h: '2.5',
                transform: 'rotate(45deg)',
                rounded: '2px',
              })}
            />
            {lastErrorText.current}
          </div>,
          document.body
        )}
    </form>
  );
}
