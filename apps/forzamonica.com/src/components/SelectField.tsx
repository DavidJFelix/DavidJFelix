import type {ComponentPropsWithoutRef} from 'react'

import {css, cx} from 'styled-system/css'
import {field} from 'styled-system/recipes'

type SelectFieldProps = ComponentPropsWithoutRef<'select'> & {
  label: string
  hint?: string
}

// Labeled native <select> in the design system's input skin, with a drawn
// chevron replacing the platform arrow.
export function SelectField({label, hint, className, children, ...props}: SelectFieldProps) {
  const classes = field()
  return (
    <label className={classes.root}>
      <span className={classes.label}>{label}</span>
      <div className={css({position: 'relative', display: 'flex'})}>
        <select
          className={cx(
            classes.control,
            css({appearance: 'none', cursor: 'pointer', pr: '9.5'}),
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className={css({
            position: 'absolute',
            right: '3.5',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'ink.muted',
            fontSize: '11px',
          })}
        >
          ▾
        </span>
      </div>
      {hint ? <span className={classes.hint}>{hint}</span> : null}
    </label>
  )
}
