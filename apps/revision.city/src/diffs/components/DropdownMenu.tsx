import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import * as React from 'react';

import { css, cx } from 'styled-system/css';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

// Shared enter/exit animation for menu surfaces, mirroring the source app's
// tw-animate-css utilities: fade+zoom plus a 0.5rem slide away from the
// anchor side, driven by the menuIn/menuOut keyframes from panda.config.
const menuMotionStyles = {
  '&[data-state="open"]': { animation: 'menuIn 150ms ease-out' },
  '&[data-state="closed"]': { animation: 'menuOut 150ms ease-in' },
  '&[data-side="bottom"]': { '--menu-slide-y': '-0.5rem' },
  '&[data-side="top"]': { '--menu-slide-y': '0.5rem' },
  '&[data-side="left"]': { '--menu-slide-x': '0.5rem' },
  '&[data-side="right"]': { '--menu-slide-x': '-0.5rem' },
} as const;

const smallItemPadding = { py: '1.5', fontSize: 'sm', lineHeight: '1.25rem' } as const;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset = false, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cx(
      css({
        display: 'flex',
        cursor: 'default',
        alignItems: 'center',
        rounded: 'diffs.sm',
        px: '2',
        ...smallItemPadding,
        outline: 'none',
        userSelect: 'none',
        _focus: { bg: 'diffs.accent' },
        '&[data-state="open"]': { bg: 'diffs.accent' },
      }),
      inset && css({ pl: '8' }),
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className={css({ ml: 'auto', h: '4', w: '4' })} />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cx(
      css({
        bg: 'diffs.popover',
        color: 'diffs.popover.foreground',
        zIndex: '50',
        minW: '8rem',
        overflow: 'hidden',
        rounded: 'diffs.md',
        borderWidth: '1px',
        borderColor: 'rgb(0 0 0 / 0.15)',
        backgroundClip: 'padding-box',
        p: '1',
        boxShadow: 'lg',
        _dark: {
          borderColor: 'rgb(255 255 255 / 0.15)',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.25), 0 4px 6px -4px rgb(0 0 0 / 0.25)',
        },
        ...menuMotionStyles,
      }),
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DEFAULT_SELECTED_ITEM_SELECTOR =
  '[data-selected="true"], [aria-current="true"], [aria-checked="true"], [data-state="checked"]';

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    scrollSelectedIntoView?: boolean;
    selectedItemSelector?: string;
  } & Pick<
      React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
      'container'
    >
>(
  (
    {
      className,
      sideOffset = 4,
      scrollSelectedIntoView = false,
      selectedItemSelector = DEFAULT_SELECTED_ITEM_SELECTOR,
      // Added by us for docs, but not generally available to our
      // users, so don't document things based on this prop
      container,
      ...props
    },
    ref
  ) => {
    const localRef = React.useRef<React.ElementRef<
      typeof DropdownMenuPrimitive.Content
    > | null>(null);
    const scrollFrameRef = React.useRef<number | null>(null);

    const setRefs = React.useCallback(
      (node: React.ElementRef<typeof DropdownMenuPrimitive.Content> | null) => {
        const scrollIntoView =
          node != null && scrollSelectedIntoView && localRef.current !== node;

        // Radix/Floating UI calls this ref super aggressively with null and
        // the same component quite a lot, resulting in false positives for
        // scrollIntoView. This is a bunch of code that's annoying to reason
        // about to work around this.
        if (node != null) {
          localRef.current = node;
        }

        if (scrollIntoView) {
          if (scrollFrameRef.current != null) {
            cancelAnimationFrame(scrollFrameRef.current);
          }

          scrollFrameRef.current = requestAnimationFrame(() => {
            scrollFrameRef.current = null;

            if (localRef.current !== node || !node.isConnected) {
              return;
            }

            node
              .querySelector<HTMLElement>(selectedItemSelector)
              ?.scrollIntoView({ block: 'nearest' });
          });
        }

        if (typeof ref === 'function') {
          ref(node);
        } else if (ref != null) {
          ref.current = node;
        }
      },
      [ref, scrollSelectedIntoView, selectedItemSelector]
    );

    React.useEffect(
      () => () => {
        localRef.current = null;
        if (scrollFrameRef.current != null) {
          cancelAnimationFrame(scrollFrameRef.current);
        }
      },
      []
    );

    return (
      <DropdownMenuPrimitive.Portal container={container}>
        <DropdownMenuPrimitive.Content
          ref={setRefs}
          sideOffset={sideOffset}
          className={cx(
            css({
              bg: 'diffs.popover',
              color: 'diffs.popover.foreground',
              zIndex: '50',
              minW: '8rem',
              '& > * + *': { mt: '1px' },
              overflow: 'hidden',
              rounded: 'diffs.lg',
              borderWidth: '1px',
              borderColor: 'rgb(0 0 0 / 0.1)',
              backgroundClip: 'padding-box',
              p: '1',
              boxShadow: 'lg',
              _dark: {
                borderColor: 'rgb(255 255 255 / 0.15)',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.25), 0 4px 6px -4px rgb(0 0 0 / 0.25)',
              },
              ...menuMotionStyles,
            }),
            className
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    );
  }
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    selected?: boolean;
    variant?: 'default' | 'danger';
  }
>(
  (
    {
      className,
      inset = false,
      selected = false,
      variant = 'default',
      ...props
    },
    ref
  ) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cx(
        css({
          position: 'relative',
          display: 'flex',
          cursor: 'default',
          alignItems: 'center',
          rounded: 'diffs.md',
          px: '3',
          ...smallItemPadding,
          outline: 'none',
          userSelect: 'none',
          _focus: { bg: 'diffs.accent', color: 'diffs.accent.foreground' },
          '&[data-disabled]': { pointerEvents: 'none', opacity: '0.5' },
        }),
        selected &&
          css({ bg: 'diffs.accent', color: 'diffs.accent.foreground' }),
        variant === 'danger' &&
          css({
            color: 'diffs.destructive',
            _focus: {
              bg: 'diffs.destructive/15',
              color: 'diffs.destructive',
            },
            _dark: {
              color: 'diffs.destructive',
              _focus: {
                bg: 'diffs.destructive/15',
                color: 'diffs.destructive',
              },
            },
          }),
        inset && css({ pl: '8' }),
        className
      )}
      data-selected={selected ? 'true' : undefined}
      {...props}
    />
  )
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
    // 'left' (default) keeps the conventional checkmark gutter on the leading
    // edge. 'right' renders the checkmark inline at the trailing edge instead,
    // which suits items that already carry their own leading icon/badge (where
    // the absolute left gutter would otherwise overlap that icon).
    indicatorSide?: 'left' | 'right';
  }
>(({ className, children, checked, indicatorSide = 'left', ...props }, ref) => {
  const indicator = (
    <DropdownMenuPrimitive.ItemIndicator>
      <Check className={css({ h: '4', w: '4' })} />
    </DropdownMenuPrimitive.ItemIndicator>
  );
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      className={cx(
        css({
          position: 'relative',
          display: 'flex',
          cursor: 'default',
          alignItems: 'center',
          rounded: 'diffs.sm',
          ...smallItemPadding,
          transition:
            'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          outline: 'none',
          userSelect: 'none',
          _focus: { bg: 'diffs.accent', color: 'diffs.accent.foreground' },
          '&[data-disabled]': { pointerEvents: 'none', opacity: '0.5' },
        }),
        indicatorSide === 'left'
          ? css({ pr: '2', pl: '8' })
          : css({ px: '2' }),
        className
      )}
      checked={checked}
      {...props}
    >
      {indicatorSide === 'left' && (
        <span
          className={css({
            position: 'absolute',
            left: '2',
            display: 'flex',
            h: '3.5',
            w: '3.5',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {indicator}
        </span>
      )}
      {children}
      {indicatorSide === 'right' && (
        <span
          className={css({
            ml: 'auto',
            display: 'flex',
            h: '3.5',
            w: '3.5',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {indicator}
        </span>
      )}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cx(
      css({
        position: 'relative',
        display: 'flex',
        cursor: 'default',
        alignItems: 'center',
        rounded: 'diffs.sm',
        pr: '2',
        pl: '8',
        ...smallItemPadding,
        transition:
          'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
        userSelect: 'none',
        _focus: { bg: 'diffs.accent', color: 'diffs.accent.foreground' },
        '&[data-disabled]': { pointerEvents: 'none', opacity: '0.5' },
      }),
      className
    )}
    {...props}
  >
    <span
      className={css({
        position: 'absolute',
        left: '2',
        display: 'flex',
        h: '3.5',
        w: '3.5',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className={css({ h: '2', w: '2', fill: 'currentcolor' })} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset = false, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cx(
      css({ px: '2', ...smallItemPadding, fontWeight: 'semibold' }),
      inset && css({ pl: '8' }),
      className
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cx(css({ bg: 'diffs.muted', mx: '-1', my: '1', h: '1px' }), className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cx(
        css({
          ml: 'auto',
          fontSize: 'xs',
          lineHeight: '1rem',
          letterSpacing: 'widest',
          opacity: '0.6',
        }),
        className
      )}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
