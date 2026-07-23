import * as SwitchPrimitives from '@radix-ui/react-switch';
import * as React from 'react';

import { css, cx } from 'styled-system/css';

const switchRootClass = css({
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
    'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  _focusVisible: {
    outline: 'none',
    boxShadow:
      'var(--background) 0 0 0 2px, var(--ring) 0 0 0 4px',
  },
  _disabled: { cursor: 'not-allowed', opacity: '0.5' },
  '&[data-state="checked"]': { bg: 'diffs.primary' },
  '&[data-state="unchecked"]': { bg: 'diffs.input' },
});

const switchThumbClass = css({
  bg: 'diffs.background',
  pointerEvents: 'none',
  display: 'block',
  h: '3',
  w: '3',
  rounded: 'full',
  boxShadow: 'lg',
  transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  '&[data-state="checked"]': { transform: 'translateX(0.5rem)' },
  '&[data-state="unchecked"]': { transform: 'translateX(0)' },
});

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cx(switchRootClass, className)}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className={switchThumbClass} />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
