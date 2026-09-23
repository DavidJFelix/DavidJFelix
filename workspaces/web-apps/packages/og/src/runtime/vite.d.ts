// The type surface of ./vite.ts for consumers. The implementation imports
// bundler-only specifiers (wasm modules, ?inline assets) that only resolve
// inside a Vite build, so the package's exports map hands TypeScript this
// declaration instead of the source; the package's own tsc and tests still
// check the implementation against ./modules.d.ts.
import type {OgRuntime} from '../image'

export declare const viteRuntime: OgRuntime
