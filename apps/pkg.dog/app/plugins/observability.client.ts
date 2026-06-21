import {initClientObservability} from '../observability/client'

// .client suffix => this plugin runs in the browser only, so neither SDK enters
// the Nitro worker bundle. Credentials come from runtimeConfig.public, populated
// at runtime from NUXT_PUBLIC_* env vars; absent vars leave each integration off.
export default defineNuxtPlugin(() => {
  const {public: pub} = useRuntimeConfig()
  initClientObservability({
    sentryDsn: pub.sentryDsn,
    posthogKey: pub.posthogKey,
    posthogHost: pub.posthogHost,
  })
})
