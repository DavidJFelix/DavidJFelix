// See https://svelte.dev/docs/kit/types#app.d.ts. Ambient (no import/export)
// so the App namespace augments globally without a module marker.
declare namespace App {
  interface Platform {
    env?: Record<string, string | undefined>
  }
}
