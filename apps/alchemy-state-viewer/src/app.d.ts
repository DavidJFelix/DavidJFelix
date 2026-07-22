// See https://svelte.dev/docs/kit/types#app.d.ts. Ambient (no import/export)
// so the App namespace augments globally without a module marker.
declare namespace App {
  interface Platform {
    env?: {
      ALCHEMY_STATE_URL?: string
      /** `secrets_store_secrets` binding to the alchemy state-store token. */
      ALCHEMY_STATE_TOKEN_SECRET?: {get: () => Promise<string>}
      /** Service binding to the `alchemy-state-store` worker. */
      ALCHEMY_STATE_STORE?: {
        fetch: (input: string | URL, init?: {headers?: Record<string, string>}) => Promise<Response>
      }
      [key: string]: unknown
    }
  }
}
