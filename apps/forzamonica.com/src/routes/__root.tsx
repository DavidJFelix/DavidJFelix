import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, Link, Outlet, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'

import {css} from 'styled-system/css'
import {button} from 'styled-system/recipes'

import {SiteFooter} from '@/components/SiteFooter.tsx'
import {SiteHeader} from '@/components/SiteHeader.tsx'
import {fetchCartQuantity} from '@/lib/shopify/cart.ts'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: 'Forza Monica'},
      {name: 'description', content: 'Forza Monica — the official shop.'},
    ],
    links: [{rel: 'stylesheet', href: appCss}],
  }),
  // Re-runs on every navigation, keeping the header badge in sync with cart
  // mutations (which all end in router.invalidate()).
  loader: () => fetchCartQuantity(),
  component: RootLayout,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootLayout() {
  const cartQuantity = Route.useLoaderData()
  return (
    <>
      <SiteHeader cartQuantity={cartQuantity} />
      <main
        className={css({maxWidth: '5xl', mx: 'auto', px: '4', pb: '16', width: 'full', flex: '1'})}
      >
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}

function NotFound() {
  return (
    <section
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4',
        py: '20',
      })}
    >
      <p
        className={css({
          fontSize: 'sm',
          fontWeight: 'semibold',
          textTransform: 'uppercase',
          letterSpacing: 'wide',
          color: 'brand',
        })}
      >
        404
      </p>
      <h1 className={css({fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight'})}>
        This page took a wrong turn
      </h1>
      <p className={css({color: 'fg.muted', maxWidth: 'prose'})}>
        The page you are looking for does not exist or has moved.
      </p>
      <Link to="/products" className={button({size: 'md'})}>
        Shop the collection
      </Link>
    </section>
  )
}

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className={css({
          bg: 'canvas',
          color: 'fg',
          fontFamily: 'sans',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        })}
      >
        {children}
        <TanStackDevtools
          config={{position: 'bottom-right'}}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
