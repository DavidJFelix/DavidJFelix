import type {ComponentType, ReactNode} from 'react'

import {css, cx} from 'styled-system/css'

interface StatusRowProps {
  icon: ComponentType<{className?: string}>
  children: ReactNode
  className?: string
}

export function StatusRow({icon: Icon, children, className}: StatusRowProps) {
  return (
    <div
      className={cx(
        css({
          color: 'diffs.muted.foreground',
          borderColor: 'diffs.border',
          display: 'flex',
          minW: '0',
          alignItems: 'center',
          gap: '2',
          borderTopWidth: '1px',
          px: {base: '4', md: '2'},
          py: '2',
          mx: {md: '3'},
        }),
        className,
      )}
    >
      <Icon className={css({w: '3', h: '3', flexShrink: '0', opacity: '0.5'})} />
      {children}
    </div>
  )
}
