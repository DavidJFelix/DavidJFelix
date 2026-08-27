import {createThemeResolver, type ThemeResolver} from '@pierre/theming'
import {createContext, useContext} from 'react'

export const ThemeResolverContext = createContext<ThemeResolver>(createThemeResolver())

export function useThemeResolver(): ThemeResolver {
  return useContext(ThemeResolverContext)
}
