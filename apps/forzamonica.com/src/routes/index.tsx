import {createFileRoute, Link} from '@tanstack/react-router'

import {css, cx} from 'styled-system/css'
import {chip} from 'styled-system/recipes'

import {ProductCard} from '@/components/ProductCard.tsx'
import {PRODUCT_KINDS, type ProductKind, productKind} from '@/lib/product-kind.ts'
import {fetchProducts} from '@/lib/shopify/catalog.ts'

type GallerySearch = {kind?: ProductKind}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): GallerySearch => {
    const kind = PRODUCT_KINDS.find((candidate) => candidate === search.kind)
    return kind ? {kind} : {}
  },
  loader: () => fetchProducts(),
  component: GalleryPage,
})

const FILTERS: Array<{label: string; kind?: ProductKind}> = [
  {label: 'All'},
  {label: 'Print', kind: 'Print'},
  {label: 'Original', kind: 'Original'},
]

function GalleryPage() {
  const products = Route.useLoaderData()
  const {kind} = Route.useSearch()
  const items = kind
    ? products.filter((product) => productKind(product.productType) === kind)
    : products
  return (
    <div className={css({maxWidth: 'page', mx: 'auto', px: '6'})}>
      <section
        className={css({
          pt: '14',
          pb: '10',
          display: 'flex',
          flexDirection: 'column',
          gap: '4',
          maxWidth: '640px',
        })}
      >
        <h1 className={css({textStyle: 'displayXl', color: 'ink'})}>
          Little paintings, made slowly
        </h1>
        <p className={css({fontSize: '16px', lineHeight: '1.6', color: 'ink.muted'})}>
          Hi, I'm Monica. I paint small watercolors of coasts, kitchens, and quiet things. Prints
          start at $45; originals are one-of-one. If you have something in mind,{' '}
          <Link
            to="/commissions"
            className={css({
              color: 'ink',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            })}
          >
            ask me about a commission
          </Link>
          .
        </p>
      </section>
      <nav aria-label="Filter the gallery" className={css({display: 'flex', gap: '2', pb: '6'})}>
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            to="/"
            search={filter.kind ? {kind: filter.kind} : {}}
            className={cx(chip({selected: kind === filter.kind}))}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className={css({color: 'ink.muted', pb: '6'})}>
          Nothing here just now — new paintings arrive slowly, on purpose.
        </p>
      ) : (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: {base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)'},
            gap: '6',
            pb: '6',
          })}
        >
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
