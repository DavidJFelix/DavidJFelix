import {createRouter, RouterProvider} from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import {initClientObservability} from './observability/client'
import {routeTree} from './routeTree.gen'
import './styles.css'

// Start client-side error monitoring + analytics (browser-only entry). Each stays
// dark until its VITE_PUBLIC_* var is set at build; both ride the same-origin
// relay served by src/worker.ts.
initClientObservability()

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// Register things for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// oxlint-disable-next-line typescript/no-non-null-assertion -- This will exist or we'll crash
const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
