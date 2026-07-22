// See https://svelte.dev/docs/kit/types#app.d.ts. Ambient (no import/export)
// so the App namespace augments globally without a module marker.
declare namespace App {
  interface Platform {
    env?: {
      ALCHEMY_STATE_URL?: string
      /** `secrets_store_secrets` binding to the alchemy state-store token. */
      ALCHEMY_STATE_TOKEN_SECRET?: {get: () => Promise<string>}
      [key: string]: unknown
    }
  }
}
