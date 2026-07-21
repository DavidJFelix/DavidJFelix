import type {Handle} from '@sveltejs/kit'
import {env} from '$env/dynamic/private'
import {parseBasicAuth, unauthorizedResponse, verifyPassword} from '$lib/server/auth'

// When APP_PASSWORD is set (the deployed configuration), every request must
// carry HTTP Basic auth with that password; any username is accepted. Unset
// means open access -- only acceptable for local dev and the smoke gate.
export const handle: Handle = async ({event, resolve}) => {
  const password = env.APP_PASSWORD
  if (password !== undefined && password !== '') {
    const credentials = parseBasicAuth(event.request.headers.get('authorization'))
    if (credentials === undefined || !(await verifyPassword(credentials.pass, password))) {
      return unauthorizedResponse()
    }
  }
  return resolve(event)
}
