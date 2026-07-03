import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {useEffect, useRef, useState} from 'react'

import {css} from 'styled-system/css'
import {button} from 'styled-system/recipes'

import {QuantityField} from '@/components/QuantityField.tsx'
import {formatPrice} from '@/lib/format-price.ts'
import {fetchCart, removeCartLine, updateCartLine} from '@/lib/shopify/cart.ts'
import type {CartLine} from '@/lib/shopify/queries.ts'

export const Route = createFileRoute('/cart')({
  loader: () => fetchCart(),
  head: () => ({meta: [{title: 'Cart — Forza Monica'}]}),
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
  // Local draft of the quantity so typing is responsive; only the settled
  // value is committed to Shopify (see scheduleQuantityCommit).
  const [quantity, setQuantity] = useState(line.quantity)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)

  function cancelScheduledCommit() {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
  }

  // Re-sync the draft (and drop any stale scheduled commit) whenever the
  // loader refreshes server truth.
  useEffect(() => {
    setQuantity(line.quantity)
    return () => {
      if (commitTimer.current) {
        clearTimeout(commitTimer.current)
        commitTimer.current = null
      }
    }
  }, [line.quantity])

  // Invalidate in finally so the loader re-runs on every outcome: success,
  // user error, and the stale-cart case where the server dropped the cookie
  // (which then resolves to the empty-cart state instead of a stuck row).
  // inFlight serializes mutations per row, and any explicit mutation
  // supersedes a pending draft commit (e.g. Remove cancels a scheduled
  // quantity update for the same line).
  async function mutate(action: () => Promise<unknown>) {
    if (inFlight.current) {
      return
    }
    cancelScheduledCommit()
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update cart')
    } finally {
      await router.invalidate()
      inFlight.current = false
      setPending(false)
    }
  }

  // Debounce quantity edits so intermediate values while typing (5 -> 1 -> 15)
  // never reach Shopify.
  function scheduleQuantityCommit(next: number) {
    setQuantity(next)
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
    }
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null
      if (next === line.quantity) {
        return
      }
      void mutate(() =>
        next === 0
          ? removeCartLine({data: {lineId: line.id}})
          : updateCartLine({data: {lineId: line.id, quantity: next}}),
      )
    }, 500)
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
        value={quantity}
        min={0}
        disabled={pending}
        onValueChange={scheduleQuantityCommit}
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
