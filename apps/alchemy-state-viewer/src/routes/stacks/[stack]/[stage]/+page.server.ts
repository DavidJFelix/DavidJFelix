import {redirect} from '@sveltejs/kit'
import {env} from '$env/dynamic/private'
import {resolveStateStoreSettings} from '$lib/server/config'
import {rethrowAsHttpError} from '$lib/server/errors'
import {createStateApi, mapWithConcurrency} from '$lib/server/state-api'
import {maskState, type PersistedStateView, statusCounts} from '$lib/state'
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
