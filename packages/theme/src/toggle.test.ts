import {expect, test, vi} from 'vitest'
import {bindThemeToggle} from './toggle'

// Deterministic matchMedia stand-in: tests flip `prefersDark` and dispatch the
// change listeners the binding registered, mirroring a live OS switch.
interface FakeMediaQuery {
  matches: boolean
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

let prefersDark = false
let mediaListeners: Array<() => void> = []

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
// fake OS preference, replaces matchMedia and storage, clears document state,
// and hands back a freshly bound toggle button.
function setup({
  osPrefersDark = false,
  initialMode = 'system',
  storageKey,
}: {osPrefersDark?: boolean; initialMode?: string; storageKey?: string} = {}) {
  prefersDark = osPrefersDark
  mediaListeners = []
  vi.stubGlobal('matchMedia', (query: string): FakeMediaQuery => {
    void query
    return {
      get matches() {
        return prefersDark
      },
      addEventListener: (_type, listener) => {
        mediaListeners.push(listener)
      },
      removeEventListener: (_type, listener) => {
        mediaListeners = mediaListeners.filter((entry) => entry !== listener)
      },
    }
  })
  vi.stubGlobal('localStorage', createFakeStorage())

  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.style.colorScheme = ''
  root.dataset.themeMode = initialMode

  document.querySelector('#theme-toggle')?.remove()
  const toggle = document.createElement('button')
  toggle.id = 'theme-toggle'
  toggle.setAttribute('aria-label', 'Toggle color theme')
  document.body.append(toggle)
  bindThemeToggle(toggle, storageKey === undefined ? {} : {storageKey})
  return toggle
}

function fireMediaChange(nextPrefersDark: boolean) {
  prefersDark = nextPrefersDark
  for (const listener of mediaListeners) {
    listener()
  }
}

test('binding replaces the static label with the next mode', () => {
  const toggle = setup({initialMode: 'dark'})
  expect(toggle.getAttribute('aria-label')).toBe('Switch to system theme')
  expect(toggle.getAttribute('title')).toBe('Switch to system theme')
})

test('an invalid data-theme-mode reads as system', () => {
  const toggle = setup({initialMode: 'blue'})
  expect(toggle.getAttribute('aria-label')).toBe('Switch to light theme')
})

test('a click cycles the mode, persists it, and applies the scheme', () => {
  const toggle = setup({initialMode: 'light'})

  toggle.click()

  const root = document.documentElement
  expect(localStorage.getItem('theme')).toBe('dark')
  expect(root.classList.contains('dark')).toBe(true)
  expect(root.classList.contains('light')).toBe(false)
  expect(root.style.colorScheme).toBe('dark')
  expect(root.dataset.themeMode).toBe('dark')
  expect(toggle.getAttribute('aria-label')).toBe('Switch to system theme')
})

test('cycling from system resolves the explicit next mode', () => {
  const toggle = setup({osPrefersDark: true, initialMode: 'system'})

  toggle.click()

  expect(localStorage.getItem('theme')).toBe('light')
  expect(document.documentElement.classList.contains('light')).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe('light')
})

test('a denied storage write still applies the mode in-memory', () => {
  const toggle = setup({initialMode: 'light'})
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw new Error('denied')
    },
  })

  toggle.click()

  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.dataset.themeMode).toBe('dark')
})

test('follows a live OS preference change while in system mode', () => {
  setup({initialMode: 'system'})

  fireMediaChange(true)

  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe('dark')
  expect(document.documentElement.dataset.themeMode).toBe('system')
})

test('ignores OS preference changes under an explicit mode', () => {
  setup({initialMode: 'light'})

  fireMediaChange(true)

  expect(document.documentElement.classList.contains('dark')).toBe(false)
})

test("adopts another tab's choice from the storage event", () => {
  setup({initialMode: 'system'})
  localStorage.setItem('theme', 'dark')

  window.dispatchEvent(new StorageEvent('storage', {key: 'theme', newValue: 'dark'}))

  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.dataset.themeMode).toBe('dark')
})

test('a cleared store falls back to system', () => {
  setup({osPrefersDark: true, initialMode: 'dark'})

  window.dispatchEvent(new StorageEvent('storage', {key: null}))

  expect(document.documentElement.dataset.themeMode).toBe('system')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})

test('ignores storage events for unrelated keys', () => {
  setup({initialMode: 'light'})
  localStorage.setItem('other', 'dark')

  window.dispatchEvent(new StorageEvent('storage', {key: 'other', newValue: 'dark'}))

  expect(document.documentElement.classList.contains('dark')).toBe(false)
  expect(document.documentElement.dataset.themeMode).toBe('light')
})

test('unreadable storage on a cross-tab event parses to system', () => {
  setup({initialMode: 'dark'})
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied')
    },
  })

  window.dispatchEvent(new StorageEvent('storage', {key: 'theme'}))

  expect(document.documentElement.dataset.themeMode).toBe('system')
})

test('a custom storage key is honored end to end', () => {
  const toggle = setup({initialMode: 'light', storageKey: 'custom-theme'})

  toggle.click()
  expect(localStorage.getItem('custom-theme')).toBe('dark')

  localStorage.setItem('custom-theme', 'system')
  window.dispatchEvent(new StorageEvent('storage', {key: 'custom-theme', newValue: 'system'}))
  expect(document.documentElement.dataset.themeMode).toBe('system')
})
