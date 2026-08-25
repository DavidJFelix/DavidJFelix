import {createContext, type ReactNode, useContext } from 'react'

export interface DiffUrlContextValue {
  url: string
}
const DiffUrlContext = createContext<DiffUrlContextValue | undefined>(undefined)

export interface DiffUrlProviderProps {
  children?: ReactNode
  url: string
}
export function DiffUrlProvider({children, url}: DiffUrlProviderProps) {
  return <DiffUrlContext.Provider value={{url}}>{children}</DiffUrlContext.Provider>
}

export function useDiffUrlContext() {
  const context = useContext(DiffUrlContext)
  if (context === undefined) {
    throw new Error('useDiffUrlContext must be used within a DiffUrlProvider')
  }
  return context
}
