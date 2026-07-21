import {error, redirect} from '@sveltejs/kit'
import {env} from '$env/dynamic/private'
import {resolveStateStoreSettings} from '$lib/server/config'
import {rethrowAsHttpError} from '$lib/server/errors'
import {createStateApi} from '$lib/server/state-api'
import {maskState, type PersistedStateView} from '$lib/state'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({params}) => {
  const settings = resolveStateStoreSettings(env)
  if (settings === undefined) {
    redirect(307, '/')
  }
  const api = createStateApi(settings)
  let state: PersistedStateView | undefined
  try {
    state = maskState(await api.getResource(params.stack, params.stage, params.fqn)) as
      | PersistedStateView
      | undefined
  } catch (cause) {
    return rethrowAsHttpError(cause)
  }
  if (state === undefined) {
    error(404, `No state for '${params.fqn}' in ${params.stack}/${params.stage}`)
  }
  return {
    stack: params.stack,
    stage: params.stage,
    fqn: params.fqn,
    state,
  }
}
