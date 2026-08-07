import {ogTags} from '@davidjfelix/og'
import {createFileRoute} from '@tanstack/react-router'

import {PolicyArticle} from '@/components/PolicyArticle.tsx'

const title = 'Returns policy — forzamonica art'

export const Route = createFileRoute('/policies/returns')({
  head: () => ({meta: [{title}, ...ogTags({title})]}),
  component: ReturnsPolicyPage,
})

function ReturnsPolicyPage() {
  return (
    <PolicyArticle title="Returns policy">
      <p>
        The shop is not taking live orders yet, so no return terms are in effect. The return window,
        condition requirements, and refund process will be published here before launch.
      </p>
      <p>Anything bought once the shop opens will be covered by the policy on this page.</p>
    </PolicyArticle>
  )
}
