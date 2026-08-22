'use agent'

import {useModel} from '@flue/runtime'

// The 'use agent' directive marks this module for Flue's agent scan; the
// exported capitalized function IS the agent, and its name is the durable
// identity (Durable Object class FlueAssistantAgent). The mount that serves it
// over HTTP lives in src/app.ts -- an unmounted agent would stay dispatch-only.
//
// The "onvibes/assistant" model is the keyless faux echo provider registered in
// src/app.ts (Flue convention: provider setup lives in the app entrypoint, not
// in agent modules). Swap it there for a real provider once credentials are
// wired.
export function Assistant() {
  useModel('onvibes/assistant')
  return 'Reply briefly and helpfully.'
}
