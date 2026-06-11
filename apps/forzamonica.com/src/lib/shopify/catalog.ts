import {createServerFn} from '@tanstack/react-start'

import {storefrontQuery} from '@/lib/shopify/client.ts'
import {
  PRODUCT_QUERY,
  PRODUCTS_QUERY,
  type ProductDetail,
  type ProductSummary,
} from '@/lib/shopify/queries.ts'

export const fetchProducts = createServerFn().handler(async () => {
  const data = await storefrontQuery<{
    products: {edges: Array<{node: ProductSummary}>}
  }>(PRODUCTS_QUERY, {first: 12})
  return data.products.edges.map((edge) => edge.node)
})

export const fetchProduct = createServerFn()
  .inputValidator((handle: string) => handle)
  .handler(async ({data: handle}) => {
    const data = await storefrontQuery<{product: ProductDetail | null}>(PRODUCT_QUERY, {handle})
    return data.product
  })
