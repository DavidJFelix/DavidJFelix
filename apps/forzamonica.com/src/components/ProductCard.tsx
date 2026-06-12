import {Link} from '@tanstack/react-router'

import {css} from 'styled-system/css'

import {formatPrice} from '@/lib/format-price.ts'
import type {ProductSummary} from '@/lib/shopify/queries.ts'

export function ProductCard({product}: {product: ProductSummary}) {
  return (
    <Link
      to="/products/$handle"
      params={{handle: product.handle}}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
        borderRadius: 'lg',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'neutral.200',
        transition: 'border-color 0.15s ease',
        _hover: {borderColor: 'neutral.400'},
      })}
    >
      {product.featuredImage ? (
        <img
          src={product.featuredImage.url}
          alt={product.featuredImage.altText ?? product.title}
          className={css({width: 'full', aspectRatio: '1', objectFit: 'cover'})}
        />
      ) : (
        <div className={css({width: 'full', aspectRatio: '1', bg: 'neutral.100'})} />
      )}
      <div className={css({display: 'flex', flexDirection: 'column', gap: '1', p: '3', pt: '1'})}>
        <h3 className={css({fontWeight: 'semibold'})}>{product.title}</h3>
        <p className={css({color: 'fg.muted', fontSize: 'sm'})}>
          from {formatPrice(product.priceRange.minVariantPrice)}
        </p>
      </div>
    </Link>
  )
}
