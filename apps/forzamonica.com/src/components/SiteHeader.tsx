import {Link, useRouterState} from '@tanstack/react-router'

import {css, cx} from 'styled-system/css'

import type {ProductKind} from '@/lib/product-kind.ts'

const navLink = css({
  fontSize: '15px',
  fontWeight: 'medium',
  color: 'ink.muted',
  px: '3.5',
  py: '2',
  borderRadius: 'pill',
  whiteSpace: 'nowrap',
  transition: 'background token(durations.quick) token(easings.out)',
  _hover: {color: 'ink'},
})

const navLinkActive = css({
  fontWeight: 'bold',
  color: 'ink',
  bg: 'paper.shade',
})

type NavItem = 'Shop' | 'Originals' | 'Commissions' | 'About'

function activeNavItem(pathname: string, kind: ProductKind | undefined): NavItem | null {
  if (pathname === '/commissions') {
    return 'Commissions'
  }
  if (pathname === '/about') {
    return 'About'
  }
  if (pathname === '/' && kind === 'Original') {
    return 'Originals'
  }
  if (pathname === '/' || pathname.startsWith('/products')) {
    return 'Shop'
  }
  return null
}

export function SiteHeader({cartQuantity}: {cartQuantity: number}) {
  const location = useRouterState({select: (state) => state.location})
  const {kind} = location.search as {kind?: ProductKind}
  const active = activeNavItem(location.pathname, kind)
  const linkClass = (item: NavItem) => cx(navLink, active === item ? navLinkActive : undefined)
  return (
    <header className={css({bg: 'paper', borderBottom: '1px solid', borderColor: 'border'})}>
      <div
        className={css({
          maxWidth: 'page',
          mx: 'auto',
          px: '6',
          py: '2',
          minHeight: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '3',
        })}
      >
        <Link to="/" className={css({textStyle: 'displayMd', color: 'ink', whiteSpace: 'nowrap'})}>
          forzamonica <span className={css({fontStyle: 'normal', fontWeight: 'normal'})}>art</span>
        </Link>
        <nav className={css({display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1'})}>
          <Link to="/" className={linkClass('Shop')}>
            Shop
          </Link>
          <Link to="/" search={{kind: 'Original'}} className={linkClass('Originals')}>
            Originals
          </Link>
          <Link to="/commissions" className={linkClass('Commissions')}>
            Commissions
          </Link>
          <Link to="/about" className={linkClass('About')}>
            About
          </Link>
        </nav>
        <Link
          to="/cart"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2',
            fontSize: '15px',
            fontWeight: 'bold',
            color: 'ink',
            border: '1.5px solid',
            borderColor: 'ink',
            borderRadius: 'pill',
            px: '4.5',
            py: '2',
            whiteSpace: 'nowrap',
            transition: 'background token(durations.quick) token(easings.out)',
            _hover: {bg: 'paper.shade'},
          })}
        >
          Cart
          {cartQuantity > 0 ? (
            <span
              className={css({
                fontSize: '12px',
                fontWeight: 'bold',
                color: 'ink',
                bg: 'pigment.butter',
                borderRadius: 'pill',
                px: '2',
                py: '0.5',
              })}
            >
              {cartQuantity}
              <span className={css({srOnly: true})}> items in cart</span>
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  )
}
