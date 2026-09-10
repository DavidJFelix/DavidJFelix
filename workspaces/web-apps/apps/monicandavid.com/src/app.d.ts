// See https://svelte.dev/docs/kit/types#app.d.ts. Ambient (no import/export)
// so the App namespace augments globally without a module marker.
declare namespace App {
  /** The verified session on a request the hook admitted (src/hooks.server.ts). */
  interface Session {
    userId: string
  }
  interface Locals {
    /** Set only on requests under /admin, which the hook refuses without one. */
    session?: Session
  }
  // interface Error {}
  // interface PageData {}
  // interface PageState {}
  // interface Platform {}
}
