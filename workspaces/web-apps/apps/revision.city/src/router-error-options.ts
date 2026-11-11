import {RouteError} from './components/route-error'

// The router puts a boundary around a route only when the route has an error
// component, so defaultOnCatch has no effect without defaultErrorComponent.
export const routerErrorOptions = {
  defaultErrorComponent: RouteError,
  // A caught render error never gets to window.onerror. reportError sends it
  // there, where Sentry's global handler records it.
  defaultOnCatch: (error: unknown) => {
    reportError(error)
  },
}
