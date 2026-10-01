### refactor(forzamonica.com): move server functions to `.validator()`

The cart, catalog, and newsletter server functions called `createServerFn().inputValidator()`, which
TanStack Start now marks as deprecated, so every `vite build` printed six deprecation warnings. They
now call `.validator()`. In the installed `@tanstack/start-client-core` the two names share one
setter and one type, so input validation and the handler's `data` type do not change.
