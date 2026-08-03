import {createRouter as createTanStackRouter} from '@tanstack/react-router'
import {initClientObservability} from './observability/client'
import {routeTree} from './routeTree.gen'

// Client-side error monitoring + analytics. This module is shared by the
// browser and the build-time shell prerender, so the guard keeps the init
// browser-only. Each integration stays dark until its VITE_PUBLIC_* var is set
// at build; both ride the same-origin relay served by src/routes/{bugs,diag}.
if (typeof document !== 'undefined') {
  initClientObservability()
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
