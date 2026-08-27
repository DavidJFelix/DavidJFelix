import {getRouteApi} from '@tanstack/react-router'

export function useRoutedDiffUrl() {
  const routeApi = getRouteApi('/diffs/$')
  const {diffUrl} = routeApi.useLoaderData()
  return diffUrl
}
