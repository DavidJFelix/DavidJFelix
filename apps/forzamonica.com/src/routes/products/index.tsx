import {createFileRoute} from '@tanstack/react-router'

import {css} from 'styled-system/css'

import {ProductCard} from '@/components/ProductCard.tsx'
import {fetchProducts} from '@/lib/shopify/catalog.ts'

export const Route = createFileRoute('/products/')({
  loader: () => fetchProducts(),
  component: ProductsPage,
})

function ProductsPage() {
  const products = Route.useLoaderData()
  return (
    <section className={css({display: 'flex', flexDirection: 'column', gap: '6', py: '8'})}>
      <h1 className={css({fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight'})}>Shop</h1>
      {products.length === 0 ? (
        <p className={css({color: 'fg.muted'})}>No products yet — check back soon.</p>
      ) : (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: {base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)'},
            gap: '6',
          })}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
