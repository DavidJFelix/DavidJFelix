// Loops (loops.so) mailing-list signup via the Contacts API
// (https://loops.so/docs/api-reference). Only ever called from the newsletter
// server function, so the API key never reaches the client bundle.

const CONTACTS_CREATE_URL = 'https://app.loops.so/api/v1/contacts/create'

export type CreateLoopsContactParams = {
  email: string
  apiKey: string | undefined
}

// Resolves true when Loops created the contact or already had it (409) -- both
// mean "you're on the list" -- and false on any failure (key unset, network
// error, bad response) so the signup form can fail soft into its error state.
export async function createLoopsContact(
  {email, apiKey}: CreateLoopsContactParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!apiKey) return false
  try {
    const response = await fetchImpl(CONTACTS_CREATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({email, source: 'forzamonica.com landing'}),
    })
    return response.ok || response.status === 409
  } catch {
    return false
  }
}
