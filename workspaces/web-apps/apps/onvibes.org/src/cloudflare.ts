// Flue 2 removed the deployment-wide FlueRegistry Durable Object, but the v1
// migration created the class and Cloudflare requires every class referenced
// by a Worker's migration history to stay exported. Retiring it with a
// deleted_classes migration is not an option here: fresh per-PR preview
// workers (bin/deploy-preview-worker.ts) replay the whole history on their
// first deploy, and the API rejects a delete-class step for a class no prior
// version of that Worker exported (error 10074). Keep an inert stand-in
// exported instead -- nothing addresses it, and the no-op alarm swallows any
// callback the beta runtime left scheduled on production instances. A plain
// class (not cloudflare:workers' DurableObject base) is a valid Durable
// Object implementation and keeps Workers type declarations out of the
// Astro-owned typecheck.
export class FlueRegistry {
  alarm(): void {}
}
