import {defineEnvVars} from '@sveltejs/kit/env'

// Both are optional: unconfigured routes render setup instructions, and the
// deployed worker reads its token from the Secrets Store binding instead.
const optional = (value: string | undefined) => value

export const variables = defineEnvVars({
  ALCHEMY_STATE_URL: {schema: optional, description: 'Base URL of the alchemy state store.'},
  ALCHEMY_STATE_TOKEN: {schema: optional, description: 'State store bearer token (local dev).'},
})
