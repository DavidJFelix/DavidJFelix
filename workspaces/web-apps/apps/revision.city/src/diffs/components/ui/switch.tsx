import {Switch as ArkSwitch} from '@ark-ui/react/switch'
import {type ReactNode, useCallback} from 'react'
import {css} from 'styled-system/css'

const switchControlClass = css({
  display: 'inline-flex',
  h: '4',
  w: '6',
  flexShrink: '0',
  cursor: 'pointer',
  alignItems: 'center',
  rounded: 'full',
  borderWidth: '2px',
  borderColor: 'transparent',
  transition:
    '[color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)]',
  '&[data-focus-visible]': {
    outline: 'none',
    boxShadow: '[var(--background) 0 0 0 2px, var(--ring) 0 0 0 4px]',
  },
  '&[data-disabled]': {cursor: 'not-allowed', opacity: '0.5'},
  '&[data-state="checked"]': {bg: 'diffs.primary'},
  '&[data-state="unchecked"]': {bg: 'diffs.input'},
})

const switchThumbClass = css({
  bg: 'diffs.background',
  pointerEvents: 'none',
  display: 'block',
  h: '3',
  w: '3',
  rounded: 'full',
  boxShadow: 'lg',
  transition: '[transform 150ms cubic-bezier(0.4, 0, 0.2, 1)]',
  '&[data-state="checked"]': {transform: 'translateX(0.5rem)'},
  '&[data-state="unchecked"]': {transform: 'translateX(0)'},
})

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
  className?: string
  labelClassName?: string
}

function Switch({checked, onCheckedChange, children, className, labelClassName}: SwitchProps) {
  const handleCheckedChange = useCallback(
    (details: ArkSwitch.CheckedChangeDetails) => {
      onCheckedChange(details.checked)
    },
    [onCheckedChange],
  )

  return (
    <ArkSwitch.Root checked={checked} onCheckedChange={handleCheckedChange} className={className}>
      <ArkSwitch.Label className={labelClassName}>{children}</ArkSwitch.Label>
      <ArkSwitch.Control className={switchControlClass}>
        <ArkSwitch.Thumb className={switchThumbClass} />
      </ArkSwitch.Control>
      <ArkSwitch.HiddenInput />
    </ArkSwitch.Root>
  )
}

export {Switch}
