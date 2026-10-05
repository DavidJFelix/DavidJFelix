import {error, redirect} from '@sveltejs/kit'
import {resolveStateStoreSettings} from '#lib/server/config.ts'
import {rethrowAsHttpError} from '#lib/server/errors.ts'
import {createStateApi} from '#lib/server/state-api.ts'
import {maskState, type PersistedStateView} from '#lib/state.ts'
import * as env from '$app/env/private'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({params, platform}) => {
  const settings = await resolveStateStoreSettings({env, platformEnv: platform?.env})
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
