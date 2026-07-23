import {Toaster as Sonner} from 'sonner'

import {css} from 'styled-system/css'

import {useTheme} from '@/diffs/components/ThemeProvider'

type ToasterProps = React.ComponentProps<typeof Sonner>

// The `.toaster &` ancestor selectors mirror the source app's
// `group-[.toaster]:` utilities: sonner applies these classes to elements
// inside the toaster root, which carries the `toaster` class below.
const toastClass = css({
  '.toaster &': {
    bg: 'diffs.background',
    color: 'diffs.foreground',
    borderColor: 'diffs.border',
    boxShadow: 'lg',
  },
})

const descriptionClass = css({
  '.toast &': {color: 'diffs.muted.foreground'},
})

const actionButtonClass = css({
  '.toast &': {bg: 'diffs.primary', color: 'diffs.primary.foreground'},
})

const cancelButtonClass = css({
  '.toast &': {bg: 'diffs.muted', color: 'diffs.muted.foreground'},
})

const Toaster = ({...props}: ToasterProps) => {
  const {colorMode = 'system'} = useTheme()

  return (
    <Sonner
      theme={colorMode as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: `group toast ${toastClass}`,
          description: descriptionClass,
          actionButton: actionButtonClass,
          cancelButton: cancelButtonClass,
        },
      }}
      {...props}
    />
  )
}

export {Toaster}
