import type {Money} from '@/lib/shopify/queries.ts'

export function formatPrice(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currencyCode,
  }).format(Number(money.amount))
}
