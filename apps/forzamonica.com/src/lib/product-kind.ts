// The catalog taxonomy from the design system: archival prints and one-of-one
// originals. Kind comes from the Shopify product type; anything else (mock.shop
// data leaves it empty) renders without a kind badge or filter match.

export type ProductKind = 'Print' | 'Original'

export const PRODUCT_KINDS: ProductKind[] = ['Print', 'Original']

export function productKind(productType: string): ProductKind | null {
  return productType === 'Print' || productType === 'Original' ? productType : null
}

export function kindTone(kind: ProductKind): 'rose' | 'sky' {
  return kind === 'Original' ? 'rose' : 'sky'
}
