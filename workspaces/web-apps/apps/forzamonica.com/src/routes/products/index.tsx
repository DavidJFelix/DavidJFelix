import {createFileRoute, redirect} from '@tanstack/react-router'

// The catalog moved to the /monica gallery; keep the old URL working for
// bookmarks and crawlers.
export const Route = createFileRoute('/products/')({
  beforeLoad: () => {
    throw redirect({to: '/monica', statusCode: 301})
  },
})
