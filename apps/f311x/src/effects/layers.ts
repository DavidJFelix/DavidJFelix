import { Layer } from 'effect'
import type { Env } from '#/lib/env'
import { EmbedderLive } from './services/embedder'
import { ModelClientLive } from './services/model-client'
import { ObjectStoreLive } from './services/object-store'
import { SandboxLive } from './services/sandbox'
import { VectorStoreLive } from './services/vector-store'
import { WorkflowDispatcherLive } from './services/workflow-dispatcher'

export const liveLayer = (env: Env) =>
  Layer.mergeAll(
    EmbedderLive(env),
    ModelClientLive(env),
    ObjectStoreLive(env),
    SandboxLive(env),
    VectorStoreLive(env),
    WorkflowDispatcherLive(env),
  )
