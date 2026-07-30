import {expect, test, vi} from 'vitest'
import {applyInitialTheme, createThemeBootstrapScript} from './theme-bootstrap'

let prefersDark = false

// In-memory Storage stand-in. Node 26 defines a global localStorage getter
// that is undefined without --localstorage-file and shadows jsdom's, so tests
// stub their own instead of relying on the environment.
function createFakeStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

// Called at the top of every test (repo style: no lifecycle hooks): resets the
// fake OS preference, replaces matchMedia and storage, and clears document
// state the bootstrap writes.
function setup({osPrefersDark = false}: {osPrefersDark?: boolean} = {}) {
  prefersDark = osPrefersDark
  vi.stubGlobal('matchMedia', () => ({matches: prefersDark}))
  vi.stubGlobal('localStorage', createFakeStorage())
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.style.colorScheme = ''
  root.removeAttribute('data-theme-mode')
  document.querySelector('meta[name="theme-color"]')?.remove()
}

test('resolves system against a dark OS preference', () => {
  setup({osPrefersDark: true})
  applyInitialTheme({storageKey: 'theme'})

  const root = document.documentElement
  expect(root.classList.contains('dark')).toBe(true)
  expect(root.classList.contains('light')).toBe(false)
  expect(root.style.colorScheme).toBe('dark')
  expect(root.getAttribute('data-theme-mode')).toBe('system')
})

test('a persisted explicit mode beats the OS preference', () => {
  setup({osPrefersDark: true})
  localStorage.setItem('theme', 'light')
  applyInitialTheme({storageKey: 'theme'})

  const root = document.documentElement
  expect(root.classList.contains('light')).toBe(true)
  expect(root.style.colorScheme).toBe('light')
  expect(root.getAttribute('data-theme-mode')).toBe('light')
})

test('an invalid persisted value falls back to system', () => {
  setup()
  localStorage.setItem('theme', 'blue')
  applyInitialTheme({storageKey: 'theme'})
  expect(document.documentElement.getAttribute('data-theme-mode')).toBe('system')
})

test('creates and fills the theme-color meta when colors are given', () => {
  setup({osPrefersDark: true})
  applyInitialTheme({storageKey: 'theme', themeColors: {light: '#ffffff', dark: '#0a0a0a'}})

  const meta = document.querySelector('meta[name="theme-color"]')
  expect(meta?.getAttribute('content')).toBe('#0a0a0a')
})

test('leaves the meta alone when no colors are given', () => {
  setup()
  applyInitialTheme({storageKey: 'theme'})
  expect(document.querySelector('meta[name="theme-color"]')).toBeNull()
})

test('storage failures leave CSS defaults in place', () => {
  setup()
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied')
    },
  })
  applyInitialTheme({storageKey: 'theme'})

  const root = document.documentElement
  expect(root.classList.contains('light')).toBe(false)
  expect(root.classList.contains('dark')).toBe(false)
})

test('the generated script is the applied function invoked with its options', () => {
  const script = createThemeBootstrapScript({storageKey: 'theme'})
  expect(script.startsWith('(')).toBe(true)
  expect(script.endsWith('({"storageKey":"theme"})')).toBe(true)
  expect(script).toContain('prefers-color-scheme: dark')
})
