import {createServerFn} from '@tanstack/react-start'
import {deleteCookie, getCookie, setCookie} from '@tanstack/react-start/server'

import {storefrontQuery} from '@/lib/shopify/client.ts'
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  type Cart,
} from '@/lib/shopify/queries.ts'

const CART_COOKIE = 'forzamonica-cart-id'
const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

type CartMutationPayload = {
  cart: Cart | null
  userErrors: Array<{field: string[] | null; message: string}>
}

// Shared recovery semantics for every cart mutation. Transport and GraphQL
// failures throw in storefrontQuery before this runs, keeping the cookie (and
// the user's cart) intact for a retry. Real user errors (e.g. sold out) come
// back alongside a live cart and throw so the UI can surface them. A null
// cart means the mutation ran but Shopify no longer has the cart -- the id is
// stale, so drop the cookie and return null for the caller to recover from.
function resolveCartMutation(payload: CartMutationPayload): Cart | null {
  if (payload.cart && payload.userErrors.length > 0) {
    throw new Error(payload.userErrors.map((e) => e.message).join('; '))
  }
  if (!payload.cart) {
    deleteCookie(CART_COOKIE)
    return null
  }
  return payload.cart
}

function rememberCartId(cartId: string) {
  setCookie(CART_COOKIE, cartId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  })
}

export const fetchCart = createServerFn().handler(async (): Promise<Cart | null> => {
  const cartId = getCookie(CART_COOKIE)
  if (!cartId) {
    return null
  }
  const data = await storefrontQuery<{cart: Cart | null}>(CART_QUERY, {cartId})
  if (!data.cart) {
    // Shopify no longer has this cart (expired or invalid) -- drop the cookie
    // so the next add-to-cart creates a fresh one.
    deleteCookie(CART_COOKIE)
  }
  return data.cart
})

export const addToCart = createServerFn({method: 'POST'})
  .inputValidator((input: {variantId: string; quantity: number}) => input)
  .handler(async ({data: {variantId, quantity}}): Promise<Cart> => {
    const lines = [{merchandiseId: variantId, quantity}]
    const cartId = getCookie(CART_COOKIE)
    if (cartId) {
      const data = await storefrontQuery<{cartLinesAdd: CartMutationPayload}>(
        CART_LINES_ADD_MUTATION,
        {cartId, lines},
      )
      const cart = resolveCartMutation(data.cartLinesAdd)
      if (cart) {
        return cart
      }
      // Stale id: the cookie is already dropped -- create a fresh cart below.
    }
    const data = await storefrontQuery<{cartCreate: CartMutationPayload}>(CART_CREATE_MUTATION, {
      lines,
    })
    const cart = resolveCartMutation(data.cartCreate)
    if (!cart) {
      throw new Error('Cart creation failed')
    }
    rememberCartId(cart.id)
    return cart
  })

// Line mutations return null when the cart has expired (cookie dropped); the
// cart page re-runs its loader after every mutation, so a null here resolves
// to the empty-cart state rather than a stuck error loop.
export const updateCartLine = createServerFn({method: 'POST'})
  .inputValidator((input: {lineId: string; quantity: number}) => input)
  .handler(async ({data: {lineId, quantity}}): Promise<Cart | null> => {
    const cartId = getCookie(CART_COOKIE)
    if (!cartId) {
      return null
    }
    const data = await storefrontQuery<{cartLinesUpdate: CartMutationPayload}>(
      CART_LINES_UPDATE_MUTATION,
      {cartId, lines: [{id: lineId, quantity}]},
    )
    return resolveCartMutation(data.cartLinesUpdate)
  })

export const removeCartLine = createServerFn({method: 'POST'})
  .inputValidator((input: {lineId: string}) => input)
  .handler(async ({data: {lineId}}): Promise<Cart | null> => {
    const cartId = getCookie(CART_COOKIE)
    if (!cartId) {
      return null
    }
    const data = await storefrontQuery<{cartLinesRemove: CartMutationPayload}>(
      CART_LINES_REMOVE_MUTATION,
      {cartId, lineIds: [lineId]},
    )
    return resolveCartMutation(data.cartLinesRemove)
  })
