import {createFileRoute, redirect} from '@tanstack/react-router'

// The catalog moved to the home page with the design-system redesign; keep
// the old URL working for bookmarks and crawlers.
export const Route = createFileRoute('/products/')({
  beforeLoad: () => {
    throw redirect({to: '/', statusCode: 301})
  },
})
