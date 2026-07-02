import {createFileRoute} from '@tanstack/react-router'

import {PolicyArticle} from '@/components/PolicyArticle.tsx'

export const Route = createFileRoute('/policies/privacy')({
  head: () => ({meta: [{title: 'Privacy policy — Forza Monica'}]}),
  component: PrivacyPolicyPage,
})

function PrivacyPolicyPage() {
  return (
    <PolicyArticle title="Privacy policy">
      <p>
        This site keeps one cookie: an httpOnly cart identifier, used only to hold your cart between
        visits. No account is required to browse or to buy. The site may also use error-monitoring
        and analytics tooling to keep the shop working well.
      </p>
      <p>
        Checkout is handled by Shopify; the data practices that apply to an order will be detailed
        here when the store goes live.
      </p>
    </PolicyArticle>
  )
}
