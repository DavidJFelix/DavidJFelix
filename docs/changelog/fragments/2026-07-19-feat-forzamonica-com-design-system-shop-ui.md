### feat(forzamonica.com): implement the design-system shop UI

The storefront now wears the forzamonica art design system (the claude.ai/design project,
`ui_kits/shop`) end to end. Tokens land in `panda.config.ts` -- paper/ink base colors, pastel
pigment chips (oklch, shared lightness/chroma, only hue varies), Newsreader display italic over
Karla UI sans, pill/card/input radii, soft shadows -- with recipes for buttons
(primary/secondary/ghost), badges, cards, filter chips, and form fields, plus the quantity stepper
restyled as the design's minus/count/plus pill.

The catalog moves to the home page as the gallery: hero intro, All/Print/Original filter chips
(`?kind=` search param; kind derives from the Shopify product type, so mock.shop data simply renders
without badges), and 4:3 product cards with striped placeholders and a Sold pill; `/products` now
redirects home. The product page gains kind badges (rose originals, sky prints, sage one-of-one,
butter sold), a size select, the pill stepper (hidden for one-of-one originals), shipping meta, and
Monica's handwritten-note quote. The cart becomes a line-items card beside a summary card with a
free-shipping nudge ($6 flat, free over $75, previewed from the subtotal) and a gift-note field
wired to Shopify's `cartNoteUpdate` so the note rides into checkout. A new `/commissions` page
carries the intro, how-it-works steps, and the commission form (front-end only until an inquiry
backend exists), and About is rewritten as Monica's story. Header, footer, policies, and the 404 all
pick up the new chrome, and page titles read "-- forzamonica art".

Storefront queries gain product type, availability, line cost, and cart note fields; whole-number
prices render bare ($45, not $45.00). The e2e suite tracks the new copy, splits the policy
assertions into one test per page, and moves the visual baseline to the static commissions page,
since the home gallery now renders live mock.shop data. A label-triggered bot workflow (mirroring
djf.io's) regenerates the app's visual baselines on the CI runner, and both snapshot bots are now
path-scoped so the shared `update-snapshots` label only fires the bot whose app the PR touches.
