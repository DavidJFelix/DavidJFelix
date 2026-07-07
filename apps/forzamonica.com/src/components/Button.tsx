import type {ComponentPropsWithoutRef} from 'react'

import {cx} from 'styled-system/css'
import {type ButtonVariantProps, button} from 'styled-system/recipes'

type ButtonProps = ComponentPropsWithoutRef<'button'> & ButtonVariantProps

export function Button({visual, size, className, type = 'button', ...props}: ButtonProps) {
  // oxlint-disable-next-line react/button-has-type -- type is constrained to the button literals and defaults to 'button'
  return <button type={type} className={cx(button({visual, size}), className)} {...props} />
}
