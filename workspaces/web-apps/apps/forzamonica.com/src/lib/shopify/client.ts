// Minimal Storefront API GraphQL client. Plain fetch keeps it portable across
// mock.shop (no auth) and a real store (public token header) -- cutover is
// config-only, no code change. Only ever runs inside server functions, so the
// token never reaches the client bundle.

const DEFAULT_API_URL = 'https://mock.shop/api'

type StorefrontEnv = {
  SHOPIFY_STOREFRONT_API_URL?: string
  SHOPIFY_STOREFRONT_PUBLIC_TOKEN?: string
}

async function storefrontConfig(): Promise<{url: string; token?: string}> {
  // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
  // environment, and this keeps it out of the client bundle entirely.
  const {env} = await import('cloudflare:workers')
  const vars = env as StorefrontEnv
  return {
    url: vars.SHOPIFY_STOREFRONT_API_URL ?? DEFAULT_API_URL,
    token: vars.SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
  }
}

export class StorefrontError extends Error {}

export async function storefrontQuery<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const {url, token} = await storefrontConfig()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {'X-Shopify-Storefront-Access-Token': token} : {}),
    },
    body: JSON.stringify({query, variables}),
  })
  if (!response.ok) {
    throw new StorefrontError(`Storefront API returned ${response.status}`)
  }
  const result = (await response.json()) as {
    data?: TData
    errors?: Array<{message: string}>
  }
  if (result.errors?.length) {
    throw new StorefrontError(result.errors.map((e) => e.message).join('; '))
  }
  if (!result.data) {
    throw new StorefrontError('Storefront API returned no data')
  }
  return result.data
}
