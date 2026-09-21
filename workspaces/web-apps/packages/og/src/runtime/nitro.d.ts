// The type surface of ./nitro.ts for consumers. The implementation imports
// bundler-only specifiers (?module wasm, raw: assets) that only resolve inside
// a Nitro build, so the package's exports map hands TypeScript this
// declaration instead of the source; the package's own tsc and tests still
// check the implementation against ./modules.d.ts.
import type {OgRuntime} from '../image'

export declare const nitroRuntime: OgRuntime
