import {createServerFn} from '@tanstack/react-start'

import {createLoopsContact} from '@/lib/loops.ts'

// Dark until the LOOPS_API_KEY secret is set (`wrangler secret put
// LOOPS_API_KEY`, or `.dev.vars` locally): submissions resolve false and the
// form shows its error state rather than pretending to subscribe anyone.
export const subscribeToNewsletter = createServerFn({method: 'POST'})
  .inputValidator((input: {email: string}) => input)
  .handler(async ({data: {email}}): Promise<boolean> => {
    // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
    // environment, and this keeps it out of the client bundle entirely.
    const {env} = await import('cloudflare:workers')
    const {LOOPS_API_KEY} = env as {LOOPS_API_KEY?: string}
    return createLoopsContact({email, apiKey: LOOPS_API_KEY})
  })
