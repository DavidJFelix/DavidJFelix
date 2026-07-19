import {createFileRoute, Link, useNavigate} from '@tanstack/react-router'
import {useState} from 'react'

import {css} from 'styled-system/css'

import {Badge} from '@/components/Badge.tsx'
import {Button} from '@/components/Button.tsx'
import {QuantityField} from '@/components/QuantityField.tsx'
import {SelectField} from '@/components/SelectField.tsx'
import {formatPrice} from '@/lib/format-price.ts'
import {kindTone, productKind} from '@/lib/product-kind.ts'
import {addToCart} from '@/lib/shopify/cart.ts'
import {fetchProduct} from '@/lib/shopify/catalog.ts'

export const Route = createFileRoute('/products/$handle')({
  loader: ({params}) => fetchProduct({data: params.handle}),
  head: ({loaderData}) => ({
    meta: [{title: loaderData ? `${loaderData.title} — forzamonica art` : 'forzamonica art'}],
  }),
  component: ProductPage,
})

function ProductPage() {
  const product = Route.useLoaderData()
  const navigate = useNavigate()
  const [variantId, setVariantId] = useState<string | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!product) {
    return (
      <section
        className={css({
          maxWidth: 'page',
          mx: 'auto',
          px: '6',
          py: '20',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4',
        })}
      >
        <h1 className={css({textStyle: 'displayLg', color: 'ink'})}>
          That painting isn't here anymore
        </h1>
        <Link
          to="/"
          className={css({fontWeight: 'bold', color: 'ink.muted', _hover: {color: 'ink'}})}
        >
          ← Back to the gallery
        </Link>
      </section>
    )
  }

  const kind = productKind(product.productType)
  const sold = !product.availableForSale
  // One-of-one originals never need a quantity picker.
  const oneOfOne = kind === 'Original'
  const variants = product.variants.edges.map((edge) => edge.node)
  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0]

  async function handleAddToCart() {
    if (!selectedVariant) {
      return
    }
    setPending(true)
    setError(null)
    try {
      await addToCart({data: {variantId: selectedVariant.id, quantity: oneOfOne ? 1 : quantity}})
      await navigate({to: '/cart'})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add to cart')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={css({maxWidth: 'page', mx: 'auto', px: '6', pt: '10', pb: '6'})}>
      <Link
        to="/"
        className={css({
          display: 'inline-block',
          fontSize: '14px',
          fontWeight: 'bold',
          color: 'ink.muted',
          mb: '6',
          _hover: {color: 'ink'},
        })}
      >
        ← Back to the gallery
      </Link>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {base: '1fr', md: '1.3fr 1fr'},
          gap: {base: '8', md: '12'},
          alignItems: 'start',
        })}
      >
        <div
          className={css({
            borderRadius: 'card',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'border',
            aspectRatio: '4 / 3',
            background:
              'repeating-linear-gradient(45deg, token(colors.paper.shade) 0 10px, #e4eaee 10px 20px)',
          })}
        >
          {product.featuredImage ? (
            <img
              src={product.featuredImage.url}
              alt={product.featuredImage.altText ?? product.title}
              className={css({width: 'full', height: 'full', objectFit: 'cover'})}
            />
          ) : null}
        </div>
        <div className={css({display: 'flex', flexDirection: 'column', gap: '5'})}>
          {kind || sold ? (
            <div className={css({display: 'flex', gap: '2'})}>
              {kind ? <Badge tone={kindTone(kind)}>{kind}</Badge> : null}
              {oneOfOne && !sold ? <Badge tone="sage">One-of-one</Badge> : null}
              {sold ? <Badge tone="butter">Sold — commission similar</Badge> : null}
            </div>
          ) : null}
          <h1 className={css({textStyle: 'displayLg', color: 'ink'})}>{product.title}</h1>
          {selectedVariant ? (
            <p className={css({fontSize: '24px', fontWeight: 'bold', color: 'ink'})}>
              {formatPrice(selectedVariant.price)}
            </p>
          ) : null}
          {product.description ? (
            <p className={css({fontSize: '15px', lineHeight: '1.6', color: 'ink.muted'})}>
              {product.description}
            </p>
          ) : null}
          {variants.length > 1 ? (
            <SelectField
              label="Size"
              value={selectedVariant?.id}
              onChange={(event) => setVariantId(event.target.value)}
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id} disabled={!variant.availableForSale}>
                  {variant.title}
                  {variant.availableForSale ? '' : ' (sold out)'}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className={css({display: 'flex', gap: '3', alignItems: 'center'})}>
            {oneOfOne ? null : (
              <QuantityField value={quantity} min={1} onValueChange={setQuantity} />
            )}
            <Button
              onClick={handleAddToCart}
              disabled={pending || sold || !selectedVariant?.availableForSale}
              className={css({flex: '1'})}
            >
              {sold ? 'Sold' : pending ? 'Adding…' : 'Add to cart'}
            </Button>
          </div>
          {error ? <p className={css({color: 'error', fontSize: '14px'})}>{error}</p> : null}
          <div
            className={css({
              borderTop: '1px solid',
              borderColor: 'border',
              pt: '4',
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              fontSize: '13px',
              color: 'ink.muted',
            })}
          >
            {selectedVariant && selectedVariant.title !== 'Default Title' ? (
              <span>{selectedVariant.title}</span>
            ) : null}
            <span>Ships flat with a backing board, within 3 days.</span>
            <span>Free shipping over $75 · returns within 30 days, no questions.</span>
          </div>
          <p className={css({textStyle: 'quote', color: 'ink.muted'})}>
            “Every order ships with a handwritten note. Tell me if it's a gift — I'll leave the
            price off.” — Monica
          </p>
        </div>
      </div>
    </section>
  )
}
