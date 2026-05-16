#!/usr/bin/env bun
// Runtime-agnostic Effect program.
//
// Inside the Worker, the live layer wires R2 / Vectorize from CF bindings.
// Here under Bun, the live layer wires the same service tags to direct
// SDK calls (or to a deployed Worker over RPC). The Effect program is
// identical -- this file demonstrates the substitution point.

import { Effect, Layer } from 'effect'
import { VectorStore } from '../src/effects/services/vector-store'

// Bun-side live layer. Replace the stub with a real Vectorize REST/SDK
// wrapper once credentials and target index are decided.
const VectorStoreBunLive = Layer.succeed(
  VectorStore,
  VectorStore.of({
    query: () =>
      Effect.succeed([]).pipe(
        Effect.tap(() =>
          Effect.sync(() => console.log('[ingest] VectorStore.query (stub)')),
        ),
      ),
    upsert: (vectors) =>
      Effect.sync(() => {
        console.log(`[ingest] VectorStore.upsert ${vectors.length} vectors (stub)`)
        return { count: vectors.length }
      }),
  }),
)

const program = Effect.gen(function* () {
  const store = yield* VectorStore
  const docs = [
    { id: 'doc-1', values: new Array(1536).fill(0), metadata: { source: 'cli' } },
  ]
  const res = yield* store.upsert(docs)
  console.log(`[ingest] upserted ${res.count}`)
})

await Effect.runPromise(program.pipe(Effect.provide(VectorStoreBunLive)))
