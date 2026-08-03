import type {Money} from '@/lib/shopify/queries.ts'

// Whole amounts render bare ("$45", like the design system's price chips);
// fractional amounts keep their cents ("$45.50").
export function formatPrice(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currencyCode,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(Number(money.amount))
}
