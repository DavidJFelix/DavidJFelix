import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the app's Start/devtools
// Vite plugins, so unit tests stay fast and isolated from the router runtime.
export default defineConfig({
  plugins: [react()],
  resolve: {tsconfigPaths: true},
  test: {
    // The file name picks the environment: `*.test.tsx` and `*.dom.test.ts` run
    // in jsdom, and the other `*.test.ts` files run in node.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts', '**/*.e2e.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'src/**/*.dom.test.ts'],
        },
      },
    ],
    // Playwright specs (*.e2e.test.ts) are driven by Playwright, not Vitest.
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Undo spies, env stubs and global stubs before each test, so a failed test leaves no state behind.
    // cSpell:words unstub -- Vitest option names
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // @pierre/icons ships ESM with imports that have no file extension, which
    // Node cannot load. Vite transforms the package so that the imports resolve.
    server: {deps: {inline: ['@pierre/icons']}},
    // The coverage gate covers the unit-tested logic: the helpers in src/lib, the
    // client-config resolver, the PR review engine (src/reviews/lib), and the
    // viewer and Symbols modules that have full coverage. The build and the smoke
    // test exercise the route glue and the client bootstrap instead.
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**',
        'src/observability/config.ts',
        'src/reviews/lib/**',
        'src/diffs/lib/{annotation,codeberg-diff-file-endpoint,codeberg-diff-source,diff-share-text,get-patch-viewer-href,github-access-remedy,github-app-budget,github-app-installations,github-diff-file-endpoint,github-diff-source,loader-error,normalize-github-path,nullish,pull-request-reference,read-limited-text,resolve-diffs-viewer-route,site,status-panel-text,theme-names,types,worker-failure}.ts',
        'src/diffs/lib/theme/chrome-theme-props.ts',
        'src/symbols/lib/{change-presentation,diff-entities,entity,language-registry}.ts',
        'src/symbols/lib/languages/{css,java,markdown,php,python,rust}.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
