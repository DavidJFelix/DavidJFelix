import {Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

export function SiteHeader({cartQuantity}: {cartQuantity: number}) {
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
        width: 'full',
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
      <nav
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '6',
          fontSize: 'sm',
          fontWeight: 'medium',
        })}
      >
        <Link to="/products" className={css({_hover: {color: 'brand'}})}>
          Shop
        </Link>
        <Link to="/about" className={css({_hover: {color: 'brand'}})}>
          About
        </Link>
        <Link
          to="/cart"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1.5',
            _hover: {color: 'brand'},
          })}
        >
          Cart
          {cartQuantity > 0 ? (
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '5',
                height: '5',
                px: '1',
                borderRadius: 'full',
                bg: 'brand',
                color: 'brand.fg',
                fontSize: 'xs',
                fontWeight: 'semibold',
              })}
            >
              {cartQuantity}
              <span className={css({srOnly: true})}> items in cart</span>
            </span>
          ) : null}
        </Link>
      </nav>
    </header>
  )
}
