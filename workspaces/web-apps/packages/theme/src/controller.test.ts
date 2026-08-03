import {expect, test, vi} from 'vitest'
import {createThemeController} from './controller'

// Deterministic matchMedia stand-in: tests flip `prefersDark` and dispatch the
// change listeners the controller registered, mirroring a live OS switch.
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
// fake OS preference, replaces matchMedia, and installs fresh persistence.
function setup({osPrefersDark = false}: {osPrefersDark?: boolean} = {}) {
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
}

function fireMediaChange(nextPrefersDark: boolean) {
  prefersDark = nextPrefersDark
  for (const listener of mediaListeners) {
    listener()
  }
}

test('defaults to system resolved against the OS preference', () => {
  setup({osPrefersDark: true})
  const controller = createThemeController()
  expect(controller.getState()).toEqual({mode: 'system', resolvedColorScheme: 'dark'})
  controller.destroy()
})

test('reads a persisted explicit mode', () => {
  setup()
  localStorage.setItem('theme', 'dark')
  const controller = createThemeController()
  expect(controller.getState()).toEqual({mode: 'dark', resolvedColorScheme: 'dark'})
  controller.destroy()
})

test('treats an invalid persisted value as system', () => {
  setup()
  localStorage.setItem('theme', 'blue')
  const controller = createThemeController()
  expect(controller.getState().mode).toBe('system')
  controller.destroy()
})

test('denied storage access reads as system', () => {
  setup()
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied')
    },
  })
  const controller = createThemeController()
  expect(controller.getState().mode).toBe('system')
  controller.destroy()
})

test('setMode persists, resolves, and notifies subscribers', () => {
  setup()
  const controller = createThemeController()
  const listener = vi.fn<() => void>()
  controller.subscribe(listener)

  controller.setMode('dark')

  expect(localStorage.getItem('theme')).toBe('dark')
  expect(controller.getState()).toEqual({mode: 'dark', resolvedColorScheme: 'dark'})
  expect(listener).toHaveBeenCalledTimes(1)
  controller.destroy()
})

test('snapshot identity is stable until state actually changes', () => {
  setup()
  const controller = createThemeController()
  const before = controller.getState()
  controller.setMode('system')
  expect(controller.getState()).toBe(before)
  controller.destroy()
})

test('follows live OS preference changes while in system mode', () => {
  setup()
  const controller = createThemeController()
  expect(controller.getState().resolvedColorScheme).toBe('light')

  fireMediaChange(true)

  expect(controller.getState().resolvedColorScheme).toBe('dark')
  controller.destroy()
})

test('ignores OS preference changes under an explicit mode', () => {
  setup()
  const controller = createThemeController()
  controller.setMode('light')

  fireMediaChange(true)

  expect(controller.getState().resolvedColorScheme).toBe('light')
  controller.destroy()
})

test("adopts another tab's choice from the storage event", () => {
  setup()
  const controller = createThemeController()
  localStorage.setItem('theme', 'dark')

  window.dispatchEvent(new StorageEvent('storage', {key: 'theme', newValue: 'dark'}))

  expect(controller.getState()).toEqual({mode: 'dark', resolvedColorScheme: 'dark'})
  controller.destroy()
})

test('a cleared store falls back to system', () => {
  setup()
  localStorage.setItem('theme', 'dark')
  const controller = createThemeController()

  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', {key: null}))

  expect(controller.getState().mode).toBe('system')
  controller.destroy()
})

test('ignores storage events for unrelated keys', () => {
  setup()
  const controller = createThemeController()
  const listener = vi.fn<() => void>()
  controller.subscribe(listener)

  window.dispatchEvent(new StorageEvent('storage', {key: 'other', newValue: 'dark'}))

  expect(listener).not.toHaveBeenCalled()
  controller.destroy()
})

test('unsubscribe and destroy stop notifications', () => {
  setup()
  const controller = createThemeController()
  const listener = vi.fn<() => void>()
  const unsubscribe = controller.subscribe(listener)

  unsubscribe()
  controller.setMode('dark')
  expect(listener).not.toHaveBeenCalled()

  controller.destroy()
  expect(mediaListeners).toHaveLength(0)
})

test('a custom storage key is honored end to end', () => {
  setup()
  localStorage.setItem('custom-theme', 'light')
  const controller = createThemeController({storageKey: 'custom-theme'})
  expect(controller.getState().mode).toBe('light')

  controller.setMode('dark')
  expect(localStorage.getItem('custom-theme')).toBe('dark')
  controller.destroy()
})
