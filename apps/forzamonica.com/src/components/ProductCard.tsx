import {Link} from '@tanstack/react-router'

import {css, cx} from 'styled-system/css'
import {card} from 'styled-system/recipes'

import {Badge} from '@/components/Badge.tsx'
import {formatPrice} from '@/lib/format-price.ts'
import {kindTone, productKind} from '@/lib/product-kind.ts'
import type {ProductSummary} from '@/lib/shopify/queries.ts'

export function ProductCard({product}: {product: ProductSummary}) {
  const kind = productKind(product.productType)
  const sold = !product.availableForSale
  return (
    <Link
      to="/products/$handle"
      params={{handle: product.handle}}
      className={cx(
        card(),
        css({
          display: 'block',
          overflow: 'hidden',
          transition: 'box-shadow token(durations.soft) token(easings.out)',
          _hover: {boxShadow: 'lift'},
        }),
      )}
    >
      <div
        className={css({
          position: 'relative',
          aspectRatio: '4 / 3',
          background:
            'repeating-linear-gradient(45deg, token(colors.paper.shade) 0 10px, #e4eaee 10px 20px)',
        })}
      >
        {product.featuredImage ? (
          <img
            src={product.featuredImage.url}
            alt={product.featuredImage.altText ?? product.title}
            className={css({
              width: 'full',
              height: 'full',
              objectFit: 'cover',
              filter: sold ? 'grayscale(0.6)' : 'none',
            })}
          />
        ) : null}
        {sold ? (
          <span
            className={css({
              position: 'absolute',
              top: '3',
              left: '3',
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'paper',
              bg: 'ink',
              borderRadius: 'pill',
              px: '2.5',
              py: '1',
            })}
          >
            Sold
          </span>
        ) : null}
      </div>
      <div className={css({pt: '4', px: '18px', pb: '18px'})}>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '3',
          })}
        >
          <h3 className={css({textStyle: 'title', color: 'ink'})}>{product.title}</h3>
          <span
            className={css({
              fontSize: '15px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              color: sold ? 'ink.faint' : 'ink',
              textDecoration: sold ? 'line-through' : 'none',
            })}
          >
            {formatPrice(product.priceRange.minVariantPrice)}
          </span>
        </div>
        {kind ? (
          <div className={css({display: 'flex', gap: '2', mt: '2', alignItems: 'center'})}>
            <Badge tone={kindTone(kind)}>{kind}</Badge>
          </div>
        ) : null}
      </div>
    </Link>
  )
}
