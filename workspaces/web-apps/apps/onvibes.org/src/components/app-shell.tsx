import {type ReactNode, useEffect} from 'react'
import {css} from 'styled-system/css'

// Sidebar + main, edge to edge. From `md` up the sidebar is a fixed column;
// below it becomes an off-canvas drawer over the main view, opened from the
// conversation header and closed by its own button, the scrim, or Escape.
const drawerClass = css({
  position: 'fixed',
  insetBlock: '0',
  insetInlineStart: '0',
  zIndex: '[20]',
  w: '72',
  maxW: '[85vw]',
  transform: 'translateX(-100%)',
  _motionSafe: {transitionProperty: '[transform]', transitionDuration: 'normal'},
  transitionTimingFunction: 'out',
  '&[data-open=true]': {transform: 'translateX(0)'},
  md: {position: 'static', transform: 'none', maxW: '[none]', flexShrink: '0'},
})

const backdropClass = css({
  position: 'fixed',
  inset: '0',
  zIndex: '[10]',
  bg: 'bg.backdrop',
  border: 'none',
  cursor: 'default',
  md: {display: 'none'},
})

export interface AppShellProps {
  sidebar: ReactNode
  children: ReactNode
  sidebarOpen: boolean
  onSidebarClose: () => void
}

export function AppShell({sidebar, children, sidebarOpen, onSidebarClose}: AppShellProps) {
  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onSidebarClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen, onSidebarClose])

  return (
    <div className={css({display: 'flex', h: 'dvh', overflow: 'hidden'})}>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onSidebarClose}
          className={backdropClass}
        />
      )}
      <aside data-open={sidebarOpen} className={drawerClass}>
        {sidebar}
      </aside>
      <div className={css({flex: '1', minW: '0', display: 'flex'})}>{children}</div>
    </div>
  )
}
