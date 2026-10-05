import {redirect} from '@sveltejs/kit'
import {resolveStateStoreSettings} from '#lib/server/config.ts'
import {rethrowAsHttpError} from '#lib/server/errors.ts'
import {createStateApi, mapWithConcurrency} from '#lib/server/state-api.ts'
import {maskState, type PersistedStateView, statusCounts} from '#lib/state.ts'
import * as env from '$app/env/private'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({params, platform}) => {
  const settings = await resolveStateStoreSettings({env, platformEnv: platform?.env})
  if (settings === undefined) {
    redirect(307, '/')
  }
  const api = createStateApi(settings)
  try {
    const fqns = (await api.listResources(params.stack, params.stage)).toSorted()
    const resources = await mapWithConcurrency(fqns, 10, async (fqn) => ({
      fqn,
      state: maskState(await api.getResource(params.stack, params.stage, fqn)) as
        | PersistedStateView
        | undefined,
    }))
    const output = maskState(await api.getStackOutput(params.stack, params.stage))
    const states = resources.flatMap(({state}) => (state === undefined ? [] : [state]))
    return {
      stack: params.stack,
      stage: params.stage,
      resources,
      output,
      counts: statusCounts(states),
    }
  } catch (cause) {
    return rethrowAsHttpError(cause)
  }
}
