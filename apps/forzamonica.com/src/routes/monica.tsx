import {createFileRoute, Link} from '@tanstack/react-router'

import {css, cx} from 'styled-system/css'
import {chip} from 'styled-system/recipes'

import {ProductCard} from '@/components/ProductCard.tsx'
import {PRODUCT_KINDS, type ProductKind, productKind} from '@/lib/product-kind.ts'
import {fetchProducts} from '@/lib/shopify/catalog.ts'

type GallerySearch = {kind?: ProductKind}

// The storefront's gallery home. Lives at /monica while the root path serves
// the pre-launch landing.
export const Route = createFileRoute('/monica')({
  validateSearch: (search: Record<string, unknown>): GallerySearch => {
    const kind = PRODUCT_KINDS.find((candidate) => candidate === search.kind)
    return kind ? {kind} : {}
  },
  loader: () => fetchProducts(),
  head: () => ({meta: [{title: 'Shop — forzamonica art'}]}),
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
        <h1 className={css({textStyle: 'displayXl', color: 'ink'})}>Watercolors by Monica Felix</h1>
        <p className={css({fontSize: '16px', lineHeight: '1.6', color: 'ink.muted'})}>
          Original paintings and archival prints, straight from the studio. Originals are
          one-of-one; prints are editions of them. If you have something in mind,{' '}
          <Link
            to="/commissions"
            className={css({
              color: 'ink',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            })}
          >
            ask about a commission
          </Link>
          .
        </p>
      </section>
      <nav aria-label="Filter the gallery" className={css({display: 'flex', gap: '2', pb: '6'})}>
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            to="/monica"
            search={filter.kind ? {kind: filter.kind} : {}}
            className={cx(chip({selected: kind === filter.kind}))}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className={css({color: 'ink.muted', pb: '6'})}>
          Nothing here right now — new work is on the way.
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
