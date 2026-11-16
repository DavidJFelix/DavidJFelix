import {type RefObject, useEffect} from 'react'

import {isNullish} from '@/diffs/lib/nullish'

export const MOBILE_MEDIA_QUERY = '(max-width: 767px)'

interface UseMobileOverlayParams {
  open: boolean
  onClose: () => void
  panelRef: RefObject<HTMLElement | null>
  scrollRef: RefObject<HTMLElement | null>
}

// While the phone overlay is open: lock the page and viewer scroll, move focus
// into the panel, and close on Escape. On close, focus goes back to the
// element that had it before the overlay opened.
export function useMobileOverlay({open, onClose, panelRef, scrollRef}: UseMobileOverlayParams) {
  useEffect(() => {
    if (!open || !window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      return
    }

    const {activeElement, body, documentElement} = document
    const opener = activeElement instanceof HTMLElement ? activeElement : null
    const codeViewScroll = scrollRef.current
    const previousBodyOverflow = body.style.overflow
    const previousRootOverscrollBehavior = documentElement.style.overscrollBehavior
    const previousCodeViewOverflow = codeViewScroll?.style.overflow

    body.style.overflow = 'hidden'
    documentElement.style.overscrollBehavior = 'none'
    if (!isNullish(codeViewScroll)) {
      codeViewScroll.style.overflow = 'hidden'
    }

    // The panel is still below the screen when it gets focus. Without
    // preventScroll, the browser scrolls the grid to show it, and the sheet
    // jumps.
    panelRef.current?.focus({preventScroll: true})
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousBodyOverflow
      documentElement.style.overscrollBehavior = previousRootOverscrollBehavior
      if (!isNullish(codeViewScroll)) {
        codeViewScroll.style.overflow = previousCodeViewOverflow ?? ''
      }
      opener?.focus()
    }
  }, [open, onClose, panelRef, scrollRef])
}
