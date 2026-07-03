// GraphQL documents and the slices of the Storefront API schema this app
// consumes. Hand-written types for now; codegen can replace them if the
// surface grows.

export type Money = {
  amount: string
  currencyCode: string
}

export type ProductImage = {
  url: string
  altText: string | null
}

export type ProductSummary = {
  id: string
  title: string
  handle: string
  featuredImage: ProductImage | null
  priceRange: {minVariantPrice: Money}
}

export type ProductVariant = {
  id: string
  title: string
  availableForSale: boolean
  price: Money
}

export type ProductDetail = {
  id: string
  title: string
  handle: string
  description: string
  featuredImage: ProductImage | null
  variants: {edges: Array<{node: ProductVariant}>}
}

export type CartLine = {
  id: string
  quantity: number
  merchandise: {
    id: string
    title: string
    price: Money
    product: {
      title: string
      handle: string
      featuredImage: ProductImage | null
    }
  }
}

export type Cart = {
  id: string
  checkoutUrl: string
  totalQuantity: number
  cost: {subtotalAmount: Money}
  lines: {edges: Array<{node: CartLine}>}
}

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`

export const PRODUCT_QUERY = /* GraphQL */ `
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      description
      featuredImage {
        url
        altText
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`

const CART_FIELDS = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price {
                amount
                currencyCode
              }
              product {
                title
                handle
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`

// Badge-sized slice of the cart for the site header; the full CART_QUERY
// stays on the cart page.
export const CART_QUANTITY_QUERY = /* GraphQL */ `
  query CartQuantity($cartId: ID!) {
    cart(id: $cartId) {
      totalQuantity
    }
  }
`

export const CART_QUERY = /* GraphQL */ `
  ${CART_FIELDS}
  query Cart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`

export const CART_CREATE_MUTATION = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: {lines: $lines}) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const CART_LINES_ADD_MUTATION = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const CART_LINES_UPDATE_MUTATION = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const CART_LINES_REMOVE_MUTATION = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`
