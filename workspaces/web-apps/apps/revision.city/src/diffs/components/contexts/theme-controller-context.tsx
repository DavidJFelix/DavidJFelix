import type {ThemeController} from '@pierre/theming'
import {createContext} from 'react'

export const ThemeControllerContext = createContext<ThemeController | undefined>(undefined)
