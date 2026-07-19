import {Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

const column = css({display: 'flex', flexDirection: 'column', gap: '2.5'})
const heading = css({textStyle: 'overline', color: 'ink'})
const link = css({fontSize: '14px', color: 'ink.muted', _hover: {color: 'ink'}})

export function SiteFooter() {
  return (
    <footer
      className={css({
        bg: 'paper.shade',
        borderTop: '1px solid',
        borderColor: 'border',
        mt: '16',
      })}
    >
      <div
        className={css({
          maxWidth: 'page',
          mx: 'auto',
          px: '6',
          pt: '12',
          pb: '8',
          display: 'grid',
          gridTemplateColumns: {base: '1fr', sm: '1fr 1fr', md: '1.6fr 1fr 1fr 1fr'},
          gap: '10',
        })}
      >
        <div className={css({display: 'flex', flexDirection: 'column', gap: '3'})}>
          <span className={css({textStyle: 'displayMd', color: 'ink'})}>
            forzamonica{' '}
            <span className={css({fontStyle: 'normal', fontWeight: 'normal'})}>art</span>
          </span>
          <p className={css({textStyle: 'quote', color: 'ink.muted', maxWidth: '300px'})}>
            “Every piece here is painted, packed, and shipped by me. Thanks for looking.” — Monica
          </p>
        </div>
        <nav aria-label="Shop" className={column}>
          <h2 className={heading}>Shop</h2>
          <Link to="/" className={link}>
            Prints
          </Link>
          <Link to="/" search={{kind: 'Original'}} className={link}>
            Originals
          </Link>
          <Link to="/commissions" className={link}>
            Commissions
          </Link>
        </nav>
        <nav aria-label="Studio" className={column}>
          <h2 className={heading}>Studio</h2>
          <Link to="/about" className={link}>
            About Monica
          </Link>
          <Link to="/cart" className={link}>
            Cart
          </Link>
        </nav>
        <nav aria-label="Help" className={column}>
          <h2 className={heading}>Help</h2>
          <Link to="/policies/shipping" className={link}>
            Shipping
          </Link>
          <Link to="/policies/returns" className={link}>
            Returns
          </Link>
          <Link to="/policies/privacy" className={link}>
            Privacy
          </Link>
        </nav>
      </div>
      <div
        className={css({
          maxWidth: 'page',
          mx: 'auto',
          px: '6',
          pb: '6',
          fontSize: '12px',
          color: 'ink.faint',
        })}
      >
        © 2026 forzamonica art · Watercolors by Monica Felix
      </div>
    </footer>
  )
}
