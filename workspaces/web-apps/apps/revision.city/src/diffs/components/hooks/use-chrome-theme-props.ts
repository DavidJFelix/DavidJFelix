import {type CSSProperties, useMemo} from 'react'
import {useThemeResolver} from '@/diffs/components/contexts/theme-resolver-context'
import {useThemeSource} from '@/diffs/components/contexts/theme-source-context'
import {isNullish} from '@/diffs/lib/nullish'
import {type ChromeMapping, chromeThemeProps} from '@/diffs/lib/theme/chrome-theme-props'
import {fixedSource, type ThemeInput} from '@/diffs/lib/theme/theme-source'

// Returns the spreadable chrome style props for the active theme, mapped to the
// app's CSS variables by the supplied mapping (diffs passes diffsChromeMapping).
export function useChromeThemeProps(
  mapping: ChromeMapping,
  theme?: ThemeInput,
): {style: CSSProperties} {
  const providerSource = useThemeSource()
  const resolver = useThemeResolver()
  const colorScheme = providerSource.activeTheme.colorScheme
  const override = useMemo(() => {
    if (isNullish(theme)) return
    return fixedSource(theme, {resolver, colorScheme})
  }, [theme, resolver, colorScheme])
  const {activeTheme} = useThemeSource(override)
  return useMemo(() => chromeThemeProps(activeTheme, mapping), [activeTheme, mapping])
}
