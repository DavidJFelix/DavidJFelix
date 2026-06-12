import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {useState} from 'react'

import {css} from 'styled-system/css'
import {button} from 'styled-system/recipes'

import {QuantityField} from '@/components/QuantityField.tsx'
import {formatPrice} from '@/lib/format-price.ts'
import {fetchCart, removeCartLine, updateCartLine} from '@/lib/shopify/cart.ts'
import type {CartLine} from '@/lib/shopify/queries.ts'

export const Route = createFileRoute('/cart')({
  loader: () => fetchCart(),
  component: CartPage,
})

function CartPage() {
  const cart = Route.useLoaderData()
  const lines = cart?.lines.edges.map((edge) => edge.node) ?? []

  if (!cart || lines.length === 0) {
    return (
      <section className={css({py: '20', display: 'flex', flexDirection: 'column', gap: '4'})}>
        <h1 className={css({fontSize: '2xl', fontWeight: 'bold'})}>Your cart is empty</h1>
        <Link to="/products" className={css({color: 'brand', fontWeight: 'medium'})}>
          Shop the collection
        </Link>
      </section>
    )
  }

  return (
    <section className={css({display: 'flex', flexDirection: 'column', gap: '6', py: '8'})}>
      <h1 className={css({fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight'})}>Cart</h1>
      <ul className={css({display: 'flex', flexDirection: 'column', gap: '4', listStyle: 'none'})}>
        {lines.map((line) => (
          <CartLineRow key={line.id} line={line} />
        ))}
      </ul>
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid',
          borderColor: 'neutral.200',
          pt: '4',
        })}
      >
        <p className={css({fontSize: 'lg'})}>
          Subtotal:{' '}
          <span className={css({fontWeight: 'semibold'})}>
            {formatPrice(cart.cost.subtotalAmount)}
          </span>
        </p>
        <a href={cart.checkoutUrl} className={button({size: 'md'})}>
          Check out
        </a>
      </div>
    </section>
  )
}

function CartLineRow({line}: {line: CartLine}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invalidate in finally so the loader re-runs on every outcome: success,
  // user error, and the stale-cart case where the server dropped the cookie
  // (which then resolves to the empty-cart state instead of a stuck row).
  async function mutate(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update cart')
    } finally {
      await router.invalidate()
      setPending(false)
    }
  }

  const image = line.merchandise.product.featuredImage
  return (
    <li
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '4',
        border: '1px solid',
        borderColor: 'neutral.200',
        borderRadius: 'lg',
        p: '3',
      })}
    >
      {image ? (
        <img
          src={image.url}
          alt={image.altText ?? line.merchandise.product.title}
          className={css({width: '20', height: '20', objectFit: 'cover', borderRadius: 'md'})}
        />
      ) : (
        <div className={css({width: '20', height: '20', bg: 'neutral.100', borderRadius: 'md'})} />
      )}
      <div className={css({display: 'flex', flexDirection: 'column', gap: '1', flex: '1'})}>
        <Link
          to="/products/$handle"
          params={{handle: line.merchandise.product.handle}}
          className={css({fontWeight: 'semibold', _hover: {color: 'brand'}})}
        >
          {line.merchandise.product.title}
        </Link>
        {line.merchandise.title !== 'Default Title' ? (
          <p className={css({fontSize: 'sm', color: 'fg.muted'})}>{line.merchandise.title}</p>
        ) : null}
        <p className={css({fontSize: 'sm'})}>{formatPrice(line.merchandise.price)}</p>
        {error ? <p className={css({fontSize: 'sm', color: 'red.600'})}>{error}</p> : null}
      </div>
      <QuantityField
        value={line.quantity}
        min={0}
        disabled={pending}
        onValueChange={(quantity) =>
          mutate(() =>
            quantity === 0
              ? removeCartLine({data: {lineId: line.id}})
              : updateCartLine({data: {lineId: line.id, quantity}}),
          )
        }
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => mutate(() => removeCartLine({data: {lineId: line.id}}))}
        className={css({
          fontSize: 'sm',
          color: 'fg.muted',
          cursor: 'pointer',
          _hover: {color: 'red.600'},
          _disabled: {opacity: 0.5},
        })}
      >
        Remove
      </button>
    </li>
  )
}
