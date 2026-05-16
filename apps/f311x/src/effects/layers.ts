import { Layer } from 'effect'
import type { Env } from '#/lib/env'
import { ObjectStoreLive } from './services/object-store'
import { VectorStoreLive } from './services/vector-store'
import { ModelClientLive } from './services/model-client'
import { SandboxLive } from './services/sandbox'
import { WorkflowDispatcherLive } from './services/workflow-dispatcher'

export const liveLayer = (env: Env) =>
  Layer.mergeAll(
    ObjectStoreLive(env),
    VectorStoreLive(env),
    ModelClientLive(env),
    SandboxLive(env),
    WorkflowDispatcherLive(env),
  )
