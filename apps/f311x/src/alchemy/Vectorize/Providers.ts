// Provider collection for the VectorizeIndex resource. Merge this layer
// with `Cloudflare.providers()` in the stack so the Alchemy CLI can
// resolve `F311x.Cloudflare.VectorizeIndex` reconciles and binding
// requests:
//
//   const providers = Layer.mergeAll(
//     Cloudflare.providers(),
//     Vectorize.providers(),
//   )

import * as Layer from 'effect/Layer'
import * as Provider from 'alchemy/Provider'
import { VectorizeIndex, VectorizeIndexProvider } from './VectorizeIndex.ts'
import {
  VectorizeIndexBindingLive,
  VectorizeIndexBindingPolicy,
  VectorizeIndexBindingPolicyLive,
} from './VectorizeIndexBinding.ts'

export class VectorizeProviders extends Provider.ProviderCollection<VectorizeProviders>()(
  'F311x.Cloudflare.Vectorize',
) {}

export const providers = () =>
  Layer.effect(
    VectorizeProviders,
    Provider.collection([VectorizeIndex, VectorizeIndexBindingPolicy]),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        VectorizeIndexProvider(),
        VectorizeIndexBindingLive,
        VectorizeIndexBindingPolicyLive,
      ),
    ),
  )
