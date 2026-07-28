// Loops (loops.so) newsletter signup. Each Loops form has a public endpoint
// made for exactly this: the browser POSTs the address as form data, no API
// key involved (https://loops.so/docs/forms/custom-form).
//
// Dark until the endpoint is set: create the form in Loops, then paste its
// endpoint URL (https://app.loops.so/api/newsletter-form/<form-id>) here.
export const LOOPS_FORM_ENDPOINT: string | null = null

export type SubscribeToLoopsParams = {
  email: string
  endpoint?: string | null
}

// Resolves false on any failure -- endpoint unset, network error, non-2xx --
// so the signup form can fail soft into its error state.
export async function subscribeToLoops(
  {email, endpoint = LOOPS_FORM_ENDPOINT}: SubscribeToLoopsParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!endpoint) return false
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      body: new URLSearchParams({email}),
    })
    return response.ok
  } catch {
    return false
  }
}
