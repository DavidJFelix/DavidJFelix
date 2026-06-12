import {Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

export function SiteHeader() {
  return (
    <header
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '5xl',
        mx: 'auto',
        px: '4',
        py: '4',
      })}
    >
      <Link
        to="/"
        className={css({
          fontWeight: 'bold',
          fontSize: 'lg',
          letterSpacing: 'wide',
          textTransform: 'uppercase',
          color: 'brand',
        })}
      >
        Forza Monica
      </Link>
      <nav className={css({display: 'flex', gap: '6', fontSize: 'sm', fontWeight: 'medium'})}>
        <Link to="/products" className={css({_hover: {color: 'brand'}})}>
          Shop
        </Link>
        <Link to="/cart" className={css({_hover: {color: 'brand'}})}>
          Cart
        </Link>
      </nav>
    </header>
  )
}
