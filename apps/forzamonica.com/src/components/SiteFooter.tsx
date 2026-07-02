import {Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

const columns = [
  {
    heading: 'Shop',
    links: [
      {label: 'All products', to: '/products'},
      {label: 'Cart', to: '/cart'},
    ],
  },
  {
    heading: 'Company',
    links: [{label: 'About', to: '/about'}],
  },
  {
    heading: 'Policies',
    links: [
      {label: 'Shipping', to: '/policies/shipping'},
      {label: 'Returns', to: '/policies/returns'},
      {label: 'Privacy', to: '/policies/privacy'},
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer
      className={css({
        borderTop: '1px solid',
        borderColor: 'neutral.200',
        mt: '16',
      })}
    >
      <div
        className={css({
          maxWidth: '5xl',
          mx: 'auto',
          px: '4',
          py: '10',
          display: 'flex',
          flexDirection: 'column',
          gap: '8',
        })}
      >
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: {base: '1fr', sm: 'repeat(3, 1fr)'},
            gap: '8',
          })}
        >
          {columns.map((column) => (
            <nav
              key={column.heading}
              aria-label={column.heading}
              className={css({display: 'flex', flexDirection: 'column', gap: '2'})}
            >
              <h2
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  textTransform: 'uppercase',
                  letterSpacing: 'wide',
                  color: 'fg.muted',
                })}
              >
                {column.heading}
              </h2>
              {column.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={css({fontSize: 'sm', _hover: {color: 'brand'}})}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <p className={css({fontSize: 'sm', color: 'fg.muted'})}>© 2026 Forza Monica</p>
      </div>
    </footer>
  )
}
