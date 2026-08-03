import {expect, test, vi} from 'vitest'

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

// The module under test is a singleton created at import time, so each test
// stubs the globals first and imports a fresh copy (no lifecycle hooks --
// repo test style).
function setup() {
  vi.resetModules()
  vi.stubGlobal('localStorage', createFakeStorage())
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  return import('./theme-controller')
}

test("another tab's mode choice is adopted via the storage event", async () => {
  const {themeController} = await setup()
  expect(themeController.getState().mode).toBe('system')

  localStorage.setItem('theme', 'dark')
  window.dispatchEvent(new StorageEvent('storage', {key: 'theme', newValue: 'dark'}))

  // Mode changes commit only after the controller's async theme resolution
  // settles, so poll instead of asserting synchronously.
  await expect.poll(() => themeController.getState().mode).toBe('dark')
})

test("another tab's theme-name choice is adopted via the storage event", async () => {
  const {docsThemeCatalog, themeController} = await setup()
  const darkNames = docsThemeCatalog.getThemeNames({colorScheme: 'dark'})
  // The empty-string fallback never selects a branch worth its own test case:
  // a catalog with no second dark theme would just fail the final assertion.
  const nonDefault = darkNames.find((name) => name !== docsThemeCatalog.defaultDarkThemeName) ?? ''

  localStorage.setItem('diffs-dark-theme', nonDefault)
  window.dispatchEvent(new StorageEvent('storage', {key: 'diffs-dark-theme', newValue: nonDefault}))

  expect(themeController.getState().darkThemeName).toBe(nonDefault)
})

test('a cleared store resets to the defaults', async () => {
  const {docsThemeCatalog, themeController} = await setup()
  themeController.setColorMode('dark')
  await expect.poll(() => themeController.getState().mode).toBe('dark')

  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', {key: null}))

  await expect.poll(() => themeController.getState().mode).toBe('system')
  expect(themeController.getState().lightThemeName).toBe(docsThemeCatalog.defaultLightThemeName)
  expect(themeController.getState().darkThemeName).toBe(docsThemeCatalog.defaultDarkThemeName)
})

test('storage events for unrelated keys are ignored', async () => {
  const {themeController} = await setup()
  localStorage.setItem('theme', 'dark')

  window.dispatchEvent(new StorageEvent('storage', {key: 'unrelated', newValue: 'dark'}))

  // Give any (incorrect) adoption time to settle before asserting nothing
  // happened; mode commits are async when they do occur.
  await new Promise((resolve) => {
    setTimeout(resolve, 50)
  })
  expect(themeController.getState().mode).toBe('system')
})
