import {FileTree, type FileTreeProps} from '@pierre/trees/react'
import {useMemo} from 'react'
import type {ThemeInput} from '@/diffs/lib/theme/theme-source'
import {useTreeThemeProps} from './hooks/use-tree-theme-props'

interface ThemedFileTreeProps extends FileTreeProps {
  // Per-component override (omitted => follow the provider).
  theme?: ThemeInput
  reconcileForegroundFromChrome?: boolean
}

// Sugar over useTreeThemeProps: applies the active theme's tree styles to the
// React <FileTree>. Caller `style` (spread after) still wins on key collisions.
export function ThemedFileTree({
  theme,
  reconcileForegroundFromChrome,
  style,
  ...props
}: ThemedFileTreeProps) {
  const themeProps = useTreeThemeProps(theme, {
    reconcileForegroundFromChrome,
  })
  const mergedStyle = useMemo(
    () => ({...themeProps.style, ...style}),
    [themeProps.style, style],
  )
  return <FileTree {...props} style={mergedStyle} />
}
