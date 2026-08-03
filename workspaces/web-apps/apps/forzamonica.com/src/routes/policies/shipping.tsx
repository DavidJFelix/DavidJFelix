import {createFileRoute} from '@tanstack/react-router'

import {PolicyArticle} from '@/components/PolicyArticle.tsx'

export const Route = createFileRoute('/policies/shipping')({
  head: () => ({meta: [{title: 'Shipping policy — forzamonica art'}]}),
  component: ShippingPolicyPage,
})

function ShippingPolicyPage() {
  return (
    <PolicyArticle title="Shipping policy">
      <p>
        The shop is not taking live orders yet, so no shipping terms are in effect. Rates, carriers,
        and delivery windows will be published here before the first order ships.
      </p>
      <p>Questions in the meantime? Check back soon — contact details arrive with the launch.</p>
    </PolicyArticle>
  )
}
