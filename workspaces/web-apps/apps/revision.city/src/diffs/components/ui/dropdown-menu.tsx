import {Menu} from '@ark-ui/react/menu'
import {Portal} from '@ark-ui/react/portal'
import {Check} from 'lucide-react'
import {
  type ComponentProps,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
} from 'react'

import {css, cx} from 'styled-system/css'

export interface DropdownMenuProps {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  onOpenChange?: (open: boolean) => void
}

function DropdownMenu({children, align = 'center', onOpenChange}: DropdownMenuProps) {
  const positioning = useMemo(
    () => ({
      placement: align === 'center' ? ('bottom' as const) : (`bottom-${align}` as const),
      gutter: 4,
    }),
    [align],
  )
  const handleOpenChange = useCallback(
    (details: Menu.OpenChangeDetails) => {
      onOpenChange?.(details.open)
    },
    [onOpenChange],
  )
  return (
    <Menu.Root lazyMount unmountOnExit positioning={positioning} onOpenChange={handleOpenChange}>
      {children}
    </Menu.Root>
  )
}

const DropdownMenuTrigger = Menu.Trigger

// Shared enter/exit animation for menu surfaces, mirroring the source app's
// tw-animate-css utilities: fade+zoom plus a 0.5rem slide away from the
// anchor side, driven by the menuIn/menuOut keyframes from panda.config.
const menuMotionStyles = {
  '&[data-state="open"]': {animation: '[menuIn 150ms ease-out]'},
  '&[data-state="closed"]': {animation: '[menuOut 150ms ease-in]'},
  '&[data-side="bottom"]': {'--menu-slide-y': '-0.5rem'},
  '&[data-side="top"]': {'--menu-slide-y': '0.5rem'},
  '&[data-side="left"]': {'--menu-slide-x': '0.5rem'},
  '&[data-side="right"]': {'--menu-slide-x': '-0.5rem'},
} as const

const smallItemPadding = {py: '1.5', fontSize: 'sm', lineHeight: '[1.25rem]'} as const

const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentProps<typeof Menu.Content>>(
  ({className, ...props}, ref) => (
    <Portal>
      <Menu.Positioner className={css({zIndex: '50'})}>
        <Menu.Content
          ref={ref}
          className={cx(
            css({
              bg: 'diffs.popover',
              color: 'diffs.popover.foreground',
              minW: '32',
              '& > * + *': {mt: '[1px]'},
              overflow: 'hidden',
              rounded: 'diffs.lg',
              borderWidth: '1px',
              borderColor: '[rgb(0 0 0 / 0.1)]',
              backgroundClip: 'padding-box',
              p: '1',
              boxShadow: 'lg',
              outline: 'none',
              _dark: {
                borderColor: '[rgb(255 255 255 / 0.15)]',
                boxShadow: '[0 10px 15px -3px rgb(0 0 0 / 0.25), 0 4px 6px -4px rgb(0 0 0 / 0.25)]',
              },
              ...menuMotionStyles,
            }),
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Portal>
  ),
)
DropdownMenuContent.displayName = 'DropdownMenuContent'

type DropdownMenuItemProps = Omit<ComponentProps<typeof Menu.Item>, 'value'> & {
  value?: string
  selected?: boolean
  variant?: 'default' | 'danger'
}

const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({className, selected = false, variant = 'default', value, ...props}, ref) => {
    const generatedValue = useId()
    return (
      <Menu.Item
        ref={ref}
        value={value ?? generatedValue}
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
            _highlighted: {bg: 'diffs.accent', color: 'diffs.accent.foreground'},
            '&[data-disabled]': {pointerEvents: 'none', opacity: '0.5'},
          }),
          selected && css({bg: 'diffs.accent', color: 'diffs.accent.foreground'}),
          variant === 'danger' &&
            css({
              color: 'diffs.destructive',
              _highlighted: {
                bg: 'diffs.destructive/15',
                color: 'diffs.destructive',
              },
              _dark: {
                color: 'diffs.destructive',
                _highlighted: {
                  bg: 'diffs.destructive/15',
                  color: 'diffs.destructive',
                },
              },
            }),
          className,
        )}
        data-selected={selected ? 'true' : undefined}
        {...props}
      />
    )
  },
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

type DropdownMenuCheckboxItemProps = Omit<
  ComponentProps<typeof Menu.CheckboxItem>,
  'value' | 'onCheckedChange'
> & {
  value?: string
  onCheckedChange?: (checked: boolean) => void
  // 'left' (default) keeps the conventional checkmark gutter on the leading
  // edge. 'right' renders the checkmark inline at the trailing edge instead,
  // which suits items that already carry their own leading icon/badge (where
  // the absolute left gutter would otherwise overlap that icon).
  indicatorSide?: 'left' | 'right'
}

const indicatorSlotClass = css({
  display: 'flex',
  h: '3.5',
  w: '3.5',
  alignItems: 'center',
  justifyContent: 'center',
})

const DropdownMenuCheckboxItem = forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
  ({className, children, indicatorSide = 'left', value, onCheckedChange, ...props}, ref) => {
    const generatedValue = useId()
    const indicator = (
      <Menu.ItemIndicator>
        <Check className={css({h: '4', w: '4'})} />
      </Menu.ItemIndicator>
    )
    return (
      <Menu.CheckboxItem
        ref={ref}
        value={value ?? generatedValue}
        onCheckedChange={onCheckedChange}
        className={cx(
          css({
            position: 'relative',
            display: 'flex',
            cursor: 'default',
            alignItems: 'center',
            rounded: 'diffs.sm',
            ...smallItemPadding,
            transition:
              '[color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)]',
            outline: 'none',
            userSelect: 'none',
            _highlighted: {bg: 'diffs.accent', color: 'diffs.accent.foreground'},
            '&[data-disabled]': {pointerEvents: 'none', opacity: '0.5'},
          }),
          indicatorSide === 'left' ? css({pr: '2', pl: '8'}) : css({px: '2'}),
          className,
        )}
        {...props}
      >
        {indicatorSide === 'left' && (
          <span className={cx(indicatorSlotClass, css({position: 'absolute', left: '2'}))}>
            {indicator}
          </span>
        )}
        {children}
        {indicatorSide === 'right' && (
          <span className={cx(indicatorSlotClass, css({ml: 'auto'}))}>{indicator}</span>
        )}
      </Menu.CheckboxItem>
    )
  },
)
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem'

function DropdownMenuLabel({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(css({px: '2', ...smallItemPadding, fontWeight: 'semibold'}), className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({className, ...props}: ComponentProps<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      className={cx(
        css({bg: 'diffs.muted', mx: '-1', my: '1', h: '[1px]', borderWidth: '0'}),
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
