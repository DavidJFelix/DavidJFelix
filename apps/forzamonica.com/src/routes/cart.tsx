import {createFileRoute, Link, useRouter} from '@tanstack/react-router'
import {useCallback, useEffect, useId, useRef, useState} from 'react'

import {css, cx} from 'styled-system/css'
import {button, card, field} from 'styled-system/recipes'

import {Badge} from '@/components/Badge.tsx'
import {QuantityField} from '@/components/QuantityField.tsx'
import {formatPrice} from '@/lib/format-price.ts'
import {kindTone, productKind} from '@/lib/product-kind.ts'
import {fetchCart, removeCartLine, updateCartLine, updateCartNote} from '@/lib/shopify/cart.ts'
import type {CartLine} from '@/lib/shopify/queries.ts'

// The shop's flat shipping policy, also quoted on the product page: $6, free
// over $75. Shopify checkout recomputes the real rate; this is the preview.
const FREE_SHIPPING_THRESHOLD = 75
const FLAT_SHIPPING = 6

// Quantity edits are debounced and the gift note commits on blur, so a click
// on Check out can otherwise outrun an unsaved change. Rows and the note field
// register a flush here; checkout settles them all before leaving for Shopify.
type CommitFlusher = () => Promise<void>
type RegisterFlush = (key: string, flush: CommitFlusher | null) => void

export const Route = createFileRoute('/cart')({
  loader: () => fetchCart(),
  head: () => ({meta: [{title: 'Cart — forzamonica art'}]}),
  component: CartPage,
})

function CartPage() {
  const cart = Route.useLoaderData()
  const lines = cart?.lines.edges.map((edge) => edge.node) ?? []
  const flushers = useRef(new Map<string, CommitFlusher>())
  const [checkingOut, setCheckingOut] = useState(false)

  const registerFlush = useCallback<RegisterFlush>((key, flush) => {
    if (flush) {
      flushers.current.set(key, flush)
    } else {
      flushers.current.delete(key)
    }
  }, [])

  async function handleCheckout(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    if (!cart || checkingOut) {
      return
    }
    setCheckingOut(true)
    try {
      await Promise.all(Array.from(flushers.current.values(), (flush) => flush()))
      window.location.assign(cart.checkoutUrl)
    } catch {
      // A pending commit failed; its row is already showing the error --
      // stay on the cart instead of checking out a stale one.
      setCheckingOut(false)
    }
  }

  if (!cart || lines.length === 0) {
    return (
      <section
        className={css({
          maxWidth: '560px',
          mx: 'auto',
          px: '6',
          py: '20',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '4',
          alignItems: 'center',
        })}
      >
        <h1 className={css({textStyle: 'displayLg', color: 'ink'})}>Your cart is empty</h1>
        <p className={css({fontSize: '15px', color: 'ink.muted'})}>
          That's easily fixed — the gallery is right this way.
        </p>
        <Link to="/monica" className={button()}>
          Browse the gallery
        </Link>
      </section>
    )
  }

  const subtotal = Number(cart.cost.subtotalAmount.amount)
  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD
  const currencyCode = cart.cost.subtotalAmount.currencyCode
  const shipping = freeShipping ? 0 : FLAT_SHIPPING

  return (
    <section className={css({maxWidth: 'page', mx: 'auto', px: '6', pt: '12', pb: '6'})}>
      <h1 className={css({textStyle: 'displayLg', color: 'ink', mb: '6'})}>Your cart</h1>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {base: '1fr', md: '1.6fr 1fr'},
          gap: {base: '8', md: '10'},
          alignItems: 'start',
        })}
      >
        <ul className={cx(card(), css({px: '6', py: '1', listStyle: 'none'}))}>
          {lines.map((line) => (
            <CartLineRow key={line.id} line={line} registerFlush={registerFlush} />
          ))}
        </ul>
        <div className={cx(card(), css({p: '6'}))}>
          <div className={css({display: 'flex', flexDirection: 'column', gap: '3.5'})}>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                color: 'ink',
              })}
            >
              <span>Subtotal</span>
              <span className={css({fontWeight: 'bold'})}>
                {formatPrice(cart.cost.subtotalAmount)}
              </span>
            </div>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                color: 'ink.muted',
              })}
            >
              <span>Shipping</span>
              <span>
                {freeShipping ? 'Free' : formatPrice({amount: String(FLAT_SHIPPING), currencyCode})}
              </span>
            </div>
            {freeShipping ? null : (
              <p
                className={css({
                  fontSize: '13px',
                  color: 'ink',
                  bg: 'pigment.butter',
                  borderRadius: 'input',
                  px: '3.5',
                  py: '2.5',
                })}
              >
                You're{' '}
                {formatPrice({
                  amount: (FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2),
                  currencyCode,
                })}{' '}
                away from free shipping.
              </p>
            )}
            <div
              className={css({
                borderTop: '1px solid',
                borderColor: 'border',
                pt: '3.5',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '17px',
                fontWeight: 'bold',
                color: 'ink',
              })}
            >
              <span>Total</span>
              <span>{formatPrice({amount: (subtotal + shipping).toFixed(2), currencyCode})}</span>
            </div>
            <GiftNoteField note={cart.note ?? ''} registerFlush={registerFlush} />
            <a
              href={cart.checkoutUrl}
              onClick={handleCheckout}
              aria-disabled={checkingOut}
              className={cx(
                button(),
                checkingOut ? css({opacity: 0.45, pointerEvents: 'none'}) : undefined,
              )}
            >
              {checkingOut ? 'Heading to checkout…' : 'Check out'}
            </a>
            <span className={css({fontSize: '12px', color: 'ink.faint', textAlign: 'center'})}>
              Ships within 3 days · returns within 30
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// Committed on blur; the note rides with the cart into Shopify checkout.
function GiftNoteField({note, registerFlush}: {note: string; registerFlush: RegisterFlush}) {
  const router = useRouter()
  const [draft, setDraft] = useState(note)
  const [error, setError] = useState<string | null>(null)
  const fieldClasses = field()
  const describedById = useId()
  const inFlight = useRef<Promise<boolean> | null>(null)

  // Re-sync the draft whenever the loader refreshes server truth.
  useEffect(() => {
    setDraft(note)
  }, [note])

  // Resolves false on failure instead of rejecting so blur can fire-and-forget
  // while checkout's flush still learns whether the note actually saved.
  function commit(): Promise<boolean> {
    if (inFlight.current) {
      return inFlight.current
    }
    if (draft === note) {
      return Promise.resolve(true)
    }
    setError(null)
    const run = (async () => {
      try {
        await updateCartNote({data: {note: draft}})
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save the note')
        return false
      } finally {
        await router.invalidate()
        inFlight.current = null
      }
    })()
    inFlight.current = run
    return run
  }

  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    registerFlush('gift-note', async () => {
      if (!(await commitRef.current())) {
        throw new Error('gift note not saved')
      }
    })
    return () => registerFlush('gift-note', null)
  }, [registerFlush])

  return (
    <label className={fieldClasses.root}>
      <span className={fieldClasses.label}>Gift note (optional)</span>
      <input
        type="text"
        value={draft}
        placeholder="Happy birthday, Sam!"
        aria-describedby={describedById}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        className={fieldClasses.control}
      />
      {error ? (
        <span id={describedById} className={fieldClasses.error}>
          {error}
        </span>
      ) : (
        <span id={describedById} className={fieldClasses.hint}>
          Handwritten by me, price left off
        </span>
      )}
    </label>
  )
}

function CartLineRow({line, registerFlush}: {line: CartLine; registerFlush: RegisterFlush}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local draft of the quantity so typing is responsive; only the settled
  // value is committed to Shopify (see scheduleQuantityCommit).
  const [quantity, setQuantity] = useState(line.quantity)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCommit = useRef<(() => Promise<boolean>) | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)

  function cancelScheduledCommit() {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
    pendingCommit.current = null
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
      pendingCommit.current = null
    }
  }, [line.quantity])

  // Invalidate in finally so the loader re-runs on every outcome: success,
  // user error, and the stale-cart case where the server dropped the cookie
  // (which then resolves to the empty-cart state instead of a stuck row).
  // inFlight serializes mutations per row, and any explicit mutation
  // supersedes a pending draft commit (e.g. Remove cancels a scheduled
  // quantity update for the same line). Resolves false on failure instead of
  // rejecting so click handlers can fire-and-forget while checkout's flush
  // still learns whether the cart is really settled.
  function mutate(action: () => Promise<unknown>): Promise<boolean> {
    if (inFlight.current) {
      return inFlight.current
    }
    cancelScheduledCommit()
    setPending(true)
    setError(null)
    const run = (async () => {
      try {
        await action()
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update cart')
        return false
      } finally {
        await router.invalidate()
        inFlight.current = null
        setPending(false)
      }
    })()
    inFlight.current = run
    return run
  }

  // Debounce quantity edits so intermediate values while typing (5 -> 1 -> 15)
  // never reach Shopify. The armed commit is kept in pendingCommit so checkout
  // can flush it early instead of racing the timer.
  function scheduleQuantityCommit(next: number) {
    setQuantity(next)
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
    }
    const action = (): Promise<boolean> => {
      cancelScheduledCommit()
      if (next === line.quantity) {
        return Promise.resolve(true)
      }
      return mutate(() =>
        next === 0
          ? removeCartLine({data: {lineId: line.id}})
          : updateCartLine({data: {lineId: line.id, quantity: next}}),
      )
    }
    pendingCommit.current = action
    commitTimer.current = setTimeout(() => {
      void action()
    }, 500)
  }

  const flushRef = useRef<() => Promise<void>>(async () => {})
  flushRef.current = async () => {
    const settled = pendingCommit.current ? await pendingCommit.current() : await inFlight.current
    if (settled === false) {
      throw new Error('cart update failed')
    }
  }

  useEffect(() => {
    registerFlush(line.id, () => flushRef.current())
    return () => registerFlush(line.id, null)
  }, [line.id, registerFlush])

  const product = line.merchandise.product
  const image = product.featuredImage
  const kind = productKind(product.productType)
  const oneOfOne = kind === 'Original'
  return (
    <li
      className={css({
        display: 'grid',
        gridTemplateColumns: '72px 1fr auto',
        gap: '4',
        alignItems: 'center',
        py: '4',
        borderBottom: '1px solid',
        borderColor: 'border',
        _last: {borderBottom: 'none'},
      })}
    >
      <div
        className={css({
          width: '72px',
          height: '72px',
          borderRadius: 'media',
          overflow: 'hidden',
          background:
            'repeating-linear-gradient(45deg, token(colors.paper.shade) 0 8px, #e4eaee 8px 16px)',
        })}
      >
        {image ? (
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            className={css({width: 'full', height: 'full', objectFit: 'cover'})}
          />
        ) : null}
      </div>
      <div className={css({display: 'flex', flexDirection: 'column', gap: '1.5', minWidth: '0'})}>
        <Link
          to="/products/$handle"
          params={{handle: product.handle}}
          className={css({textStyle: 'title', fontSize: '18px', color: 'ink'})}
        >
          {product.title}
        </Link>
        <div className={css({display: 'flex', gap: '2', alignItems: 'center', flexWrap: 'wrap'})}>
          {kind ? <Badge tone={kindTone(kind)}>{kind}</Badge> : null}
          {line.merchandise.title !== 'Default Title' ? (
            <span className={css({fontSize: '12px', color: 'ink.muted'})}>
              {line.merchandise.title}
            </span>
          ) : null}
        </div>
        {error ? <p className={css({fontSize: '13px', color: 'error'})}>{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => mutate(() => removeCartLine({data: {lineId: line.id}}))}
          className={css({
            alignSelf: 'flex-start',
            fontSize: '12px',
            color: 'ink.muted',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            _hover: {color: 'ink'},
            _disabled: {opacity: 0.5},
          })}
        >
          Remove
        </button>
      </div>
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2.5',
        })}
      >
        <span className={css({fontSize: '15px', fontWeight: 'bold', color: 'ink'})}>
          {formatPrice(line.cost.totalAmount)}
        </span>
        {oneOfOne ? null : (
          <QuantityField
            value={quantity}
            min={0}
            disabled={pending}
            onValueChange={scheduleQuantityCommit}
          />
        )}
      </div>
    </li>
  )
}
