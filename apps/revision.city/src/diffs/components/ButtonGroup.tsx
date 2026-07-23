import * as React from 'react'

import {css, cx} from 'styled-system/css'

import {Button, type ButtonProps} from './Button'

interface ButtonGroupContextValue {
  selectedValue?: string
  onValueChange?: (value: string) => void
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
}

const ButtonGroupContext = React.createContext<ButtonGroupContextValue>({})

interface ButtonGroupProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  value?: string
  onValueChange?: (value: string) => void
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  children: React.ReactNode
}

function ButtonGroup({
  className,
  value,
  onValueChange,
  variant = 'outline',
  size,
  children,
  ...props
}: ButtonGroupProps) {
  return (
    <ButtonGroupContext.Provider
      value={{
        selectedValue: value,
        onValueChange,
        variant,
        size,
      }}
    >
      <fieldset
        className={cx(
          css({
            bg: 'diffs.secondary',
            display: 'inline-flex',
            alignSelf: 'flex-start',
            rounded: 'diffs.lg',
            // Neutralize fieldset UA defaults Panda's reset does not cover.
            m: '0',
            p: '0',
            borderWidth: '0',
            minInlineSize: 'auto',
          }),
          className,
        )}
        {...props}
      >
        {children}
      </fieldset>
    </ButtonGroupContext.Provider>
  )
}

interface ButtonGroupItemProps extends Omit<ButtonProps, 'variant'> {
  value: string
  children: React.ReactNode
}

function ButtonGroupItem({className, value, children, onClick, ...props}: ButtonGroupItemProps) {
  const context = React.useContext(ButtonGroupContext)
  const isSelected = context.selectedValue === value

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context.onValueChange?.(value)
    onClick?.(event)
  }

  return (
    <Button
      className={cx(
        css({
          color: 'diffs.muted.foreground',
          // The source app exposed a `--radius-lg` CSS variable equal to
          // `--radius`; the port only kept `--radius` (see panda.config.ts's
          // `diffs.lg` radii token), so this references that directly to
          // keep the item's corners 1px inside the group's rounded-lg edge.
          rounded: 'calc(var(--radius) - 1px)',
          gap: '1.5',
        }),
        isSelected &&
          css({
            color: 'diffs.foreground',
            pointerEvents: 'none',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          }),
        className,
      )}
      variant={isSelected ? (context.variant ?? 'outline') : 'ghost'}
      size={context.size}
      onClick={handleClick}
      title={value}
      {...props}
    >
      {children}
    </Button>
  )
}

const ButtonGroupPositionContext = React.createContext<'first' | 'middle' | 'last' | 'only'>('only')

function ButtonGroupProvider({children}: {children: React.ReactNode}) {
  const childrenArray = React.Children.toArray(children)
  const childCount = childrenArray.length

  return (
    <>
      {childrenArray.map((child, index) => {
        let position: 'first' | 'middle' | 'last' | 'only' = 'only'

        if (childCount > 1) {
          if (index === 0) position = 'first'
          else if (index === childCount - 1) position = 'last'
          else position = 'middle'
        }

        // Children.toArray assigns every element a stable key, so use it
        // instead of the array index.
        const key = React.isValidElement(child) ? (child.key ?? String(position)) : String(child)
        return (
          <ButtonGroupPositionContext.Provider key={key} value={position}>
            {child}
          </ButtonGroupPositionContext.Provider>
        )
      })}
    </>
  )
}

// Enhance ButtonGroup to automatically provide position context
function EnhancedButtonGroup({children, ...props}: ButtonGroupProps) {
  return (
    <ButtonGroup {...props}>
      <ButtonGroupProvider>{children}</ButtonGroupProvider>
    </ButtonGroup>
  )
}

EnhancedButtonGroup.displayName = 'ButtonGroup'

export {ButtonGroupItem, EnhancedButtonGroup as ButtonGroup}
