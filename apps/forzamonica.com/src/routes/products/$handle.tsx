import {createFileRoute, Link, useNavigate} from '@tanstack/react-router'
import {useState} from 'react'

import {css} from 'styled-system/css'

import {Button} from '@/components/Button.tsx'
import {QuantityField} from '@/components/QuantityField.tsx'
import {formatPrice} from '@/lib/format-price.ts'
import {addToCart} from '@/lib/shopify/cart.ts'
import {fetchProduct} from '@/lib/shopify/catalog.ts'

export const Route = createFileRoute('/products/$handle')({
  loader: ({params}) => fetchProduct({data: params.handle}),
  head: ({loaderData}) => ({
    meta: [{title: loaderData ? `${loaderData.title} — Forza Monica` : 'Forza Monica'}],
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
      <section className={css({py: '20', display: 'flex', flexDirection: 'column', gap: '4'})}>
        <h1 className={css({fontSize: '2xl', fontWeight: 'bold'})}>Product not found</h1>
        <Link to="/products" className={css({color: 'brand', fontWeight: 'medium'})}>
          Back to the collection
        </Link>
      </section>
    )
  }

  const variants = product.variants.edges.map((edge) => edge.node)
  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0]

  async function handleAddToCart() {
    if (!selectedVariant) {
      return
    }
    setPending(true)
    setError(null)
    try {
      await addToCart({data: {variantId: selectedVariant.id, quantity}})
      await navigate({to: '/cart'})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add to cart')
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      className={css({
        display: 'grid',
        gridTemplateColumns: {base: '1fr', md: '1fr 1fr'},
        gap: '10',
        py: '8',
      })}
    >
      {product.featuredImage ? (
        <img
          src={product.featuredImage.url}
          alt={product.featuredImage.altText ?? product.title}
          className={css({width: 'full', borderRadius: 'lg', objectFit: 'cover'})}
        />
      ) : (
        <div className={css({width: 'full', aspectRatio: '1', bg: 'neutral.100'})} />
      )}
      <div className={css({display: 'flex', flexDirection: 'column', gap: '5'})}>
        <h1 className={css({fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight'})}>
          {product.title}
        </h1>
        {selectedVariant ? (
          <p className={css({fontSize: 'xl', fontWeight: 'semibold'})}>
            {formatPrice(selectedVariant.price)}
          </p>
        ) : null}
        {variants.length > 1 ? (
          <label className={css({display: 'flex', flexDirection: 'column', gap: '1'})}>
            <span className={css({fontSize: 'sm', color: 'fg.muted'})}>Variant</span>
            <select
              value={selectedVariant?.id}
              onChange={(event) => setVariantId(event.target.value)}
              className={css({
                border: '1px solid',
                borderColor: 'neutral.300',
                borderRadius: 'md',
                px: '3',
                py: '2',
                maxWidth: 'xs',
                bg: 'canvas',
              })}
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id} disabled={!variant.availableForSale}>
                  {variant.title}
                  {variant.availableForSale ? '' : ' (sold out)'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <QuantityField label="Quantity" value={quantity} min={1} onValueChange={setQuantity} />
        <Button
          onClick={handleAddToCart}
          disabled={pending || !selectedVariant?.availableForSale}
          className={css({maxWidth: 'fit'})}
        >
          {pending ? 'Adding…' : 'Add to cart'}
        </Button>
        {error ? <p className={css({color: 'red.600', fontSize: 'sm'})}>{error}</p> : null}
        {product.description ? (
          <p className={css({color: 'fg.muted', maxWidth: 'prose'})}>{product.description}</p>
        ) : null}
      </div>
    </section>
  )
}
