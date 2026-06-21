import {createRouter as createTanStackRouter} from '@tanstack/react-router'

import {initClientObservability} from './observability/client'
import {routeTree} from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  // Browser-only: SSR builds dead-code-eliminate this, so the SDKs never enter
  // the worker bundle.
  if (!import.meta.env.SSR) {
    initClientObservability()
  }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
