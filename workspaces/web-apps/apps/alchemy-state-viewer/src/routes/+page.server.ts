import {env} from '$env/dynamic/private'
import {resolveStateStoreSettings} from '$lib/server/config'
import {rethrowAsHttpError} from '$lib/server/errors'
import {createStateApi, mapWithConcurrency} from '$lib/server/state-api'
import type {PageServerLoad} from './$types'

export const load: PageServerLoad = async ({platform}) => {
  const settings = await resolveStateStoreSettings({env, platformEnv: platform?.env})
  if (settings === undefined) {
    return {configured: false as const}
  }
  const api = createStateApi(settings)
  try {
    const stacks = (await api.listStacks()).toSorted()
    const withStages = await mapWithConcurrency(stacks, 5, async (stack) => ({
      name: stack,
      stages: (await api.listStages(stack)).toSorted(),
    }))
    return {
      configured: true as const,
      storeUrl: settings.url,
      stacks: withStages,
    }
  } catch (cause) {
    return rethrowAsHttpError(cause)
  }
}
