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

function assertNoUserErrors(payload: CartMutationPayload): Cart {
  if (payload.userErrors.length > 0) {
    throw new Error(payload.userErrors.map((e) => e.message).join('; '))
  }
  if (!payload.cart) {
    throw new Error('Cart mutation returned no cart')
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
      // Transport and GraphQL failures throw here and propagate, keeping the
      // cookie (and the user's cart) intact for a retry. Only an explicit
      // null cart -- the mutation ran but Shopify no longer has the cart --
      // means the id is stale and a fresh cart is safe to create.
      const data = await storefrontQuery<{cartLinesAdd: CartMutationPayload}>(
        CART_LINES_ADD_MUTATION,
        {cartId, lines},
      )
      if (data.cartLinesAdd.cart) {
        // Real user errors (e.g. sold out) come back alongside a live cart.
        return assertNoUserErrors(data.cartLinesAdd)
      }
      deleteCookie(CART_COOKIE)
    }
    const data = await storefrontQuery<{cartCreate: CartMutationPayload}>(CART_CREATE_MUTATION, {
      lines,
    })
    const cart = assertNoUserErrors(data.cartCreate)
    rememberCartId(cart.id)
    return cart
  })

export const updateCartLine = createServerFn({method: 'POST'})
  .inputValidator((input: {lineId: string; quantity: number}) => input)
  .handler(async ({data: {lineId, quantity}}): Promise<Cart> => {
    const cartId = getCookie(CART_COOKIE)
    if (!cartId) {
      throw new Error('No cart to update')
    }
    const data = await storefrontQuery<{cartLinesUpdate: CartMutationPayload}>(
      CART_LINES_UPDATE_MUTATION,
      {cartId, lines: [{id: lineId, quantity}]},
    )
    return assertNoUserErrors(data.cartLinesUpdate)
  })

export const removeCartLine = createServerFn({method: 'POST'})
  .inputValidator((input: {lineId: string}) => input)
  .handler(async ({data: {lineId}}): Promise<Cart> => {
    const cartId = getCookie(CART_COOKIE)
    if (!cartId) {
      throw new Error('No cart to update')
    }
    const data = await storefrontQuery<{cartLinesRemove: CartMutationPayload}>(
      CART_LINES_REMOVE_MUTATION,
      {cartId, lineIds: [lineId]},
    )
    return assertNoUserErrors(data.cartLinesRemove)
  })
