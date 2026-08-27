import {getRouteApi} from '@tanstack/react-router'

export function useDiffUrl() {
  const routeApi = getRouteApi('/diffs/$')
  const {diffUrl} = routeApi.useLoaderData()
  return diffUrl
}
