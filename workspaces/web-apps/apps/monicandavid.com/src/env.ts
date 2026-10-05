import {defineEnvVars} from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  // Optional at startup: only /admin needs it, and the hook answers 500 there
  // when it is missing (src/hooks.server.ts).
  SESSION_SECRET: {
    schema: (value: string | undefined) => value,
    description: 'HS256 key for the session cookie JWT.',
  },
})
